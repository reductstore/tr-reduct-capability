const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { URL } = require("node:url");

const installer = require("../robot/lib/install-binaries");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function makeArchive(dir, name, entry, body) {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "tr-native-src-"));
  fs.writeFileSync(path.join(source, entry), body, { mode: 0o755 });
  const archive = path.join(dir, name);
  execFileSync("tar", ["-C", source, "-czf", archive, entry]);
  fs.rmSync(source, { recursive: true, force: true });
  return archive;
}

function makeZip(dir, name, entry, body) {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "tr-native-src-"));
  const file = path.join(source, entry);
  fs.writeFileSync(file, body, { mode: 0o755 });
  const archive = path.join(dir, name);
  execFileSync("zip", ["-q", "-j", archive, file]);
  fs.rmSync(source, { recursive: true, force: true });
  return archive;
}

async function serve(dir) {
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    const name = path.basename(
      new URL(request.url, "http://localhost").pathname,
    );
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200).end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    get requests() {
      return requests;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("exposes the complete Linux x64 native binary set from the manifest", () => {
  const bins = installer.assetsFor("linux", "x64").map((asset) => asset.bin);
  assert.deepEqual(bins, [
    "reductstore",
    "reduct-bridge-ros2-jazzy",
    "reduct-bridge-ros2-humble",
    "reduct-bridge-ros1",
    "reduct-bridge-iot",
  ]);
  assert.deepEqual(installer.assetsFor("linux", "x64")[0], {
    bin: "reductstore",
    entry: "reductstore-pro",
    archive: "zip",
    integrity: "transport",
    minGlibc: "2.38",
    url: "https://api.reduct.store/v1/transitive/reductstore-pro/linux/x64",
  });
});

test("exposes ReductStore Pro and every bridge variant for Linux arm64", () => {
  assert.deepEqual(installer.assetsFor("linux", "arm64"), [
    {
      bin: "reductstore",
      entry: "reductstore-pro",
      archive: "zip",
      integrity: "transport",
      minGlibc: "2.38",
      url: "https://api.reduct.store/v1/transitive/reductstore-pro/linux/arm64",
    },
    {
      bin: "reduct-bridge-ros2-jazzy",
      entry: "reduct-bridge",
      sha256:
        "f4c867abe793965c0aec15282b3cb11ba09887d224d974e6a7f0a675154dc772",
      url: "https://github.com/reductstore/reduct-bridge/releases/download/v0.5.7/bridge-ros2-jazzy.aarch64-unknown-linux-gnu.tar.gz",
    },
    {
      bin: "reduct-bridge-ros2-humble",
      entry: "reduct-bridge",
      sha256:
        "b9c673baee04b0a3e857e3220a94021b8021af6205f6231da6e4f1b64300b149",
      url: "https://github.com/reductstore/reduct-bridge/releases/download/v0.5.7/bridge-ros2-humble.aarch64-unknown-linux-gnu.tar.gz",
    },
    {
      bin: "reduct-bridge-ros1",
      entry: "reduct-bridge",
      sha256:
        "573684a4409f2d27338a100c4edf33c8af043144a734a5402fa39f6ec27921b7",
      url: "https://github.com/reductstore/reduct-bridge/releases/download/v0.5.7/bridge-ros1.aarch64-unknown-linux-gnu.tar.gz",
    },
    {
      bin: "reduct-bridge-iot",
      entry: "reduct-bridge",
      sha256:
        "e359bbfe84d431c57455391f5eb5ae768645ec4f8f3432b0551915d23256e2e4",
      url: "https://github.com/reductstore/reduct-bridge/releases/download/v0.5.7/bridge-iot.aarch64-unknown-linux-gnu.tar.gz",
    },
  ]);
});

test("downloads the detected architecture, extracts binaries, and caches", async () => {
  const release = fs.mkdtempSync(path.join(os.tmpdir(), "tr-native-release-"));
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "tr-native-bin-"));
  const server = await serve(release);
  try {
    const specs = [
      { bin: "reductstore", entry: "reductstore", file: "store.tar.gz" },
      { bin: "reduct-bridge-iot", entry: "reduct-bridge", file: "iot.tar.gz" },
    ];
    const manifest = {
      "linux-x64": specs.map((spec) => {
        const archive = makeArchive(release, spec.file, spec.entry, spec.bin);
        return {
          bin: spec.bin,
          entry: spec.entry,
          url: `http://127.0.0.1:${server.port}/${spec.file}`,
          sha256: sha256(fs.readFileSync(archive)),
        };
      }),
    };

    await installer.installNativeBinaries({
      platform: "linux",
      architecture: "x64",
      destination,
      manifest,
    });
    for (const spec of specs) {
      const binary = path.join(destination, spec.bin);
      assert.equal(fs.readFileSync(binary, "utf8"), spec.bin);
      assert.ok(fs.statSync(binary).mode & 0o100);
    }

    const downloaded = server.requests;
    await installer.installNativeBinaries({
      platform: "linux",
      architecture: "x64",
      destination,
      manifest,
    });
    assert.equal(
      server.requests,
      downloaded,
      "cached install must not refetch",
    );
  } finally {
    await server.close();
  }
});

test("downloads the Transitive Pro ZIP through its trusted endpoint", async () => {
  const release = fs.mkdtempSync(path.join(os.tmpdir(), "tr-native-pro-"));
  const destination = fs.mkdtempSync(
    path.join(os.tmpdir(), "tr-native-pro-bin-"),
  );
  const server = await serve(release);
  try {
    makeZip(release, "reductstore.zip", "reductstore", "reductstore-pro");
    const manifest = {
      "linux-x64": [
        {
          bin: "reductstore",
          entry: "reductstore",
          archive: "zip",
          integrity: "transport",
          url: `http://127.0.0.1:${server.port}/reductstore.zip`,
        },
      ],
    };

    await installer.installNativeBinaries({
      platform: "linux",
      architecture: "x64",
      destination,
      manifest,
    });

    assert.equal(
      fs.readFileSync(path.join(destination, "reductstore"), "utf8"),
      "reductstore-pro",
    );
  } finally {
    await server.close();
  }
});

test("rejects a native binary whose checksum does not match", async () => {
  const release = fs.mkdtempSync(path.join(os.tmpdir(), "tr-native-bad-"));
  const destination = fs.mkdtempSync(
    path.join(os.tmpdir(), "tr-native-bad-bin-"),
  );
  const server = await serve(release);
  try {
    makeArchive(release, "store.tar.gz", "reductstore", "reductstore");
    const manifest = {
      "linux-x64": [
        {
          bin: "reductstore",
          entry: "reductstore",
          url: `http://127.0.0.1:${server.port}/store.tar.gz`,
          sha256: "deadbeef",
        },
      ],
    };
    await assert.rejects(
      () =>
        installer.installNativeBinaries({
          platform: "linux",
          architecture: "x64",
          destination,
          manifest,
        }),
      /Checksum mismatch/,
    );
  } finally {
    await server.close();
  }
});

test("rejects an asset whose minGlibc exceeds the system glibc before downloading", async () => {
  const destination = fs.mkdtempSync(
    path.join(os.tmpdir(), "tr-native-glibc-"),
  );
  let fetched = false;
  const manifest = {
    "linux-x64": [
      {
        bin: "reductstore",
        entry: "reductstore-pro",
        archive: "zip",
        integrity: "transport",
        minGlibc: "99.99",
        url: "http://127.0.0.1:1/never",
      },
    ],
  };

  await assert.rejects(
    () =>
      installer.installNativeBinaries({
        platform: "linux",
        architecture: "x64",
        destination,
        manifest,
        fetchImpl: async () => {
          fetched = true;
          throw new Error("must not download");
        },
      }),
    /glibc/,
  );
  assert.equal(fetched, false);
});

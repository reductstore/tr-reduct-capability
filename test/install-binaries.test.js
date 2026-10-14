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
  assert.throws(() => installer.assetsFor("linux", "arm64"), /Unsupported/);
});

test("downloads the detected architecture, verifies checksums, and caches", async () => {
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

const { execFileSync } = require("node:child_process");
const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "..",
  "native-dependencies.json",
);
const DEFAULT_DESTINATION = path.join(__dirname, "..", "bin");

function loadManifest(file = MANIFEST_PATH) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function platformKey(platform, architecture) {
  return `${platform}-${architecture}`;
}

function assetsFor(platform, architecture, manifest = loadManifest()) {
  const assets = manifest[platformKey(platform, architecture)];
  if (!assets) {
    throw new Error(
      `Unsupported platform and architecture: ${platformKey(
        platform,
        architecture,
      )}. Supported: ${Object.keys(manifest).join(", ")}.`,
    );
  }
  return assets;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function download(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function archiveType(asset) {
  const type = asset.archive || "tar.gz";
  if (type !== "tar.gz" && type !== "zip") {
    throw new Error(`Unsupported archive type for ${asset.bin}: ${type}.`);
  }
  return type;
}

function assertSafeArchive(archive, asset) {
  const type = archiveType(asset);
  const entries = execFileSync(
    type === "zip" ? "unzip" : "tar",
    type === "zip" ? ["-Z1", archive] : ["-tzf", archive],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/");
    if (
      path.posix.isAbsolute(normalized) ||
      normalized.split("/").includes("..")
    ) {
      throw new Error(`Unsafe archive entry: ${entry}`);
    }
  }
}

function findEntry(directory, entry) {
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      const found = findEntry(file, entry);
      if (found) return found;
    } else if (stat.isFile() && name === entry) {
      return file;
    }
  }
  return null;
}

function extractBinary(archive, asset, destination) {
  const type = archiveType(asset);
  assertSafeArchive(archive, asset);
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "reductstore-extract-"),
  );
  try {
    execFileSync(
      type === "zip" ? "unzip" : "tar",
      type === "zip"
        ? ["-q", archive, "-d", directory]
        : ["-xzf", archive, "-C", directory],
    );
    const source = findEntry(directory, asset.entry);
    if (!source) throw new Error(`Missing ${asset.entry} in ${asset.url}.`);
    const target = path.join(destination, asset.bin);
    fs.copyFileSync(source, target);
    fs.chmodSync(target, 0o755);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function markerPath(destination) {
  return path.join(destination, ".installed.json");
}

function signatureFor(assets) {
  return JSON.stringify(
    assets.map((asset) => [
      asset.bin,
      asset.url,
      asset.archive || "tar.gz",
      asset.sha256 || null,
      asset.integrity || null,
    ]),
  );
}

function isInstalled(destination, assets) {
  if (
    !assets.every((asset) => fs.existsSync(path.join(destination, asset.bin)))
  )
    return false;
  try {
    return (
      fs.readFileSync(markerPath(destination), "utf8") === signatureFor(assets)
    );
  } catch {
    return false;
  }
}

function assertIntegrity(buffer, asset) {
  if (!asset.sha256) {
    if (asset.integrity === "transport") return;
    throw new Error(`Missing checksum for ${asset.bin}.`);
  }
  const expected = asset.sha256.replace(/^sha256:/, "").toLowerCase();
  if (sha256(buffer) !== expected) {
    throw new Error(`Checksum mismatch for ${asset.bin} from ${asset.url}.`);
  }
}

async function installNativeBinaries({
  platform = process.platform,
  architecture = process.arch,
  destination = DEFAULT_DESTINATION,
  manifest = loadManifest(),
  fetchImpl = fetch,
  force = false,
} = {}) {
  const assets = assetsFor(platform, architecture, manifest);
  if (!force && isInstalled(destination, assets)) return;

  fs.mkdirSync(destination, { recursive: true });
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "reductstore-download-"));
  try {
    for (const asset of assets) {
      const buffer = await download(asset.url, fetchImpl);
      assertIntegrity(buffer, asset);
      const archive = path.join(stage, `${asset.bin}.${archiveType(asset)}`);
      fs.writeFileSync(archive, buffer);
      extractBinary(archive, asset, destination);
    }
    fs.writeFileSync(markerPath(destination), signatureFor(assets));
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const run = async () => {
    if (process.env.SKIP_NATIVE_BINARIES) {
      process.stderr.write(
        "SKIP_NATIVE_BINARIES set, skipping native binary download.\n",
      );
      return;
    }
    try {
      assetsFor(process.platform, process.arch);
    } catch (error) {
      process.stderr.write(
        `Skipping native binary download: ${error.message}\n`,
      );
      return;
    }
    await installNativeBinaries();
  };
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { assetsFor, installNativeBinaries, loadManifest };

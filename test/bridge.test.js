const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const bridge = require("../robot/lib/bridge");
const { defaults } = require("../robot/lib/config");

test("selects native executables for every supported bridge variant", () => {
  assert.equal(
    bridge.binaryName({ variant: "ros2-jazzy" }),
    "reduct-bridge-ros2-jazzy",
  );
  assert.equal(
    bridge.binaryName({ variant: "ros2-humble" }),
    "reduct-bridge-ros2-humble",
  );
  assert.equal(bridge.binaryName({ variant: "ros1" }), "reduct-bridge-ros1");
  assert.equal(bridge.binaryName({ variant: "iot" }), "reduct-bridge-iot");
});

test("buildEnvironment keeps ROS settings out of IoT processes", () => {
  const ros = bridge.buildEnvironment({
    ...defaults().bridge,
    variant: "ros2-jazzy",
    rosDomainId: 5,
  });
  assert.equal(ros.ROS_DOMAIN_ID, "5");
  assert.equal(ros.HOME, "/tmp");
  assert.equal(ros.FASTDDS_BUILTIN_TRANSPORTS, "UDPv4");

  const iot = bridge.buildEnvironment({
    ...defaults().bridge,
    variant: "iot",
  });
  assert.equal(iot.ROS_DOMAIN_ID, undefined);
  assert.equal(iot.HOME, undefined);
  assert.equal(iot.FASTDDS_BUILTIN_TRANSPORTS, undefined);
});

test("writeToml writes managed bridge configuration verbatim", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bridge-toml-"));
  const file = path.join(dir, "bridge.toml");
  const toml = '[remotes.reduct.local]\nurl = "http://127.0.0.1:8383"\n';
  bridge.writeToml({ toml }, file);
  assert.equal(fs.readFileSync(file, "utf8"), toml);
});

test("renders the MQTT preset with the current local store settings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bridge-preset-"));
  const file = path.join(dir, "bridge.toml");
  bridge.writeToml({ preset: "mqtt", toml: "" }, file, {
    httpPort: 9000,
    apiToken: "token",
    bucket: { name: "telemetry" },
  });
  const toml = fs.readFileSync(file, "utf8");
  assert.match(toml, /url = "http:\/\/127.0.0.1:9000"/);
  assert.match(toml, /token_api = "token"/);
  assert.match(toml, /\[inputs.mqtt.main\]/);
});

test("disabled bridges remain stopped", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bridge-disabled-"));
  const config = {
    ...defaults().bridge,
    enabled: false,
  };

  const processOptions = { runtimeDir: dir };
  assert.deepEqual(await bridge.start(config, processOptions), {
    enabled: false,
    running: false,
  });
  assert.equal((await bridge.status(config, processOptions)).running, false);
});

test("starts, reports, and stops a detached native bridge process", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bridge-"));
  const config = {
    ...defaults().bridge,
    enabled: true,
  };
  const processOptions = {
    runtimeDir: dir,
    executable: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
  };

  await bridge.start(config, processOptions);
  assert.equal((await bridge.status(config, processOptions)).running, true);
  await bridge.stop(config, processOptions);
  assert.equal((await bridge.status(config, processOptions)).running, false);
});

test("reports a native bridge process error from its log", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-bridge-error-"));
  const config = {
    ...defaults().bridge,
    enabled: true,
  };
  const processOptions = {
    runtimeDir: dir,
    executable: process.execPath,
    args: ["-e", "console.error('bridge failure')"],
  };

  await bridge.start(config, processOptions);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const status = await bridge.status(config, processOptions);
  assert.equal(status.running, false);
  assert.match(status.error, /bridge failure/);
});

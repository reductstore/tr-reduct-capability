const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const bridge = require("../robot/lib/bridge");
const { defaults } = require("../robot/lib/config");

function joined(args) {
  return args.join(" ");
}

test("buildRunArgs mounts the TOML read-only, uses host net + ROS_DOMAIN_ID", () => {
  const b = { ...defaults().bridge, rosDomainId: 5 };
  const s = joined(bridge.buildRunArgs(b, "/tmp/bridge.toml"));
  assert.match(s, /--network host/);
  assert.match(s, /-e ROS_DOMAIN_ID=5/);
  assert.match(s, /-e HOME=\/tmp/); // ROS 2 needs a writable home for ~/.ros/log
  assert.match(s, /-e FASTDDS_BUILTIN_TRANSPORTS=UDPv4/); // data over UDP, not cross-uid SHM
  assert.match(
    s,
    new RegExp(`/tmp/bridge.toml:${bridge.CONTAINER_CONFIG_PATH}:ro`),
  );
  assert.match(s, /--restart unless-stopped/);
  // command is `reduct-bridge <config path>`, not just the config path
  assert.ok(s.endsWith(`reduct-bridge ${bridge.CONTAINER_CONFIG_PATH}`));
});

test("buildRunArgs adds extra read-only mounts", () => {
  const b = { ...defaults().bridge, mounts: ["/opt/ros_msgs"] };
  const s = joined(bridge.buildRunArgs(b, "/tmp/bridge.toml"));
  assert.match(s, /-v \/opt\/ros_msgs:\/opt\/ros_msgs:ro/);
});

test("buildRunArgs mounts each list entry, trimming and skipping blanks", () => {
  const b = { ...defaults().bridge, mounts: ["/a", " /b ", "", "   "] };
  const s = joined(bridge.buildRunArgs(b, "/tmp/bridge.toml"));
  assert.match(s, /-v \/a:\/a:ro/);
  assert.match(s, /-v \/b:\/b:ro/); // trimmed, no surrounding spaces
  assert.doesNotMatch(s, /-v :/); // blank/whitespace rows produce no mount
});

test("buildRunArgs adds ROS env only for ROS images", () => {
  const iot = joined(
    bridge.buildRunArgs(
      { ...defaults().bridge, image: "reduct/bridge:latest-iot" },
      "/t.toml",
    ),
  );
  assert.doesNotMatch(iot, /ROS_DOMAIN_ID/);
  assert.doesNotMatch(iot, /HOME=\/tmp/);
  assert.doesNotMatch(iot, /FASTDDS/);

  const ros1 = joined(
    bridge.buildRunArgs(
      { ...defaults().bridge, image: "reduct/bridge:latest-ros1" },
      "/t.toml",
    ),
  );
  assert.match(ros1, /-e HOME=\/tmp/); // ROS 1 needs a writable home
  assert.doesNotMatch(ros1, /ROS_DOMAIN_ID/); // but not the ROS 2 DDS env
  assert.doesNotMatch(ros1, /FASTDDS/);
});

test("buildRunArgs appends extra bridge env vars", () => {
  const b = {
    ...defaults().bridge,
    env: [
      { key: "RMW_IMPLEMENTATION", value: "rmw_cyclonedds_cpp" },
      { key: "", value: "skip" },
    ],
  };
  const s = joined(bridge.buildRunArgs(b, "/tmp/bridge.toml"));
  assert.match(s, /-e RMW_IMPLEMENTATION=rmw_cyclonedds_cpp/);
  assert.doesNotMatch(s, /=skip/);
});

test("writeToml writes the operator TOML verbatim", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-toml-"));
  const file = path.join(dir, "bridge.toml");
  const toml = '[remotes.reduct.local]\nurl = "http://127.0.0.1:8383"\n';
  bridge.writeToml({ toml }, file);
  assert.equal(fs.readFileSync(file, "utf8"), toml);
});

test("start on a disabled bridge just ensures it is stopped", async () => {
  const calls = [];
  const runner = async (cmd, args) => {
    calls.push(args[0]);
    return "";
  };
  const result = await bridge.start(
    { ...defaults().bridge, enabled: false },
    runner,
  );
  assert.equal(result.running, false);
  assert.deepEqual(calls, ["rm"]); // only the stop/rm, no run
});

test("status treats a restarting container as not running", async () => {
  const runner = async () => "id|restarting|true|4|img";
  const s = await bridge.status(defaults().bridge, runner);
  assert.equal(s.running, false);
  assert.equal(s.restartCount, 4);
});

const noWait = { graceMs: 0, settleMs: 0 };

test("start throws when the bridge crash loops (e.g. bad TOML)", async () => {
  const runner = async (cmd, args) =>
    args[0] === "inspect" ? "id|restarting|true|3|img" : "";
  await assert.rejects(
    () => bridge.start({ ...defaults().bridge, enabled: true }, runner, noWait),
    /failed to start/,
  );
});

test("start throws when the restart count keeps climbing", async () => {
  let n = 0;
  const runner = async (cmd, args) => {
    if (args[0] !== "inspect") return "";
    n += 1;
    return `id|running|false|${n}|img`; // rc climbs across the two samples
  };
  await assert.rejects(
    () => bridge.start({ ...defaults().bridge, enabled: true }, runner, noWait),
    /failed to start/,
  );
});

test("start tolerates a transient crash that recovered", async () => {
  // running with a nonzero but stable restart count = crashed once, recovered
  const runner = async (cmd, args) =>
    args[0] === "inspect" ? "id|running|false|1|img" : "";
  const result = await bridge.start(
    { ...defaults().bridge, enabled: true },
    runner,
    noWait,
  );
  assert.equal(result.running, true);
});

test("start succeeds when the container stays up", async () => {
  const runner = async (cmd, args) =>
    args[0] === "inspect" ? "abc|running|false|0|img" : "";
  const result = await bridge.start(
    { ...defaults().bridge, enabled: true },
    runner,
    noWait,
  );
  assert.equal(result.running, true);
});

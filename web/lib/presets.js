// Keep the templates identical to robot/lib/presets.js so that a TOML generated
// here matches what the robot renders when bridge.toml is left empty.

export const VARIANTS = [
  { value: "ros2-jazzy", label: "ROS 2 (Jazzy)" },
  { value: "ros2-humble", label: "ROS 2 (Humble)" },
  { value: "ros1", label: "ROS 1" },
  { value: "iot", label: "IoT: MQTT / HTTP / Shell" },
];

const quoted = (value) => JSON.stringify(String(value));

const remoteHeader = (store) =>
  `[remotes.reduct.local]
url = ${quoted(`http://127.0.0.1:${store?.httpPort ?? 8383}`)}
token_api = ${quoted(store?.apiToken ?? "transitive-local-token")}
bucket = ${quoted(store?.bucket?.name ?? "robot-data")}
prefix = "bridge/"
`;

const ros2Distro = (variant) =>
  variant === "ros2-humble" ? "humble" : "jazzy";

export const PRESETS = [
  {
    value: "ros2",
    label: "ROS 2",
    build: (store, variant) => `${remoteHeader(store)}
[inputs.ros2.ros2_local]
node_name = "reduct_bridge"
queue_size = 128
domain_id = 0
schema_paths = ["/opt/ros/${ros2Distro(variant)}"]

[[inputs.ros2.ros2_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros2_local"]
`,
  },
  {
    value: "ros1",
    label: "ROS 1",
    build: (store) => `${remoteHeader(store)}
[inputs.ros.ros_local]
uri = "http://localhost:11311"
node_name = "reduct_bridge"
queue_size = 128

[[inputs.ros.ros_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros_local"]
`,
  },
  {
    value: "mqtt",
    label: "MQTT",
    build: (store) => `${remoteHeader(store)}
[inputs.mqtt.main]
broker = "mqtt://localhost:1883"
client_id = "reduct-bridge"
version = "v5"
qos = 1

[[inputs.mqtt.main.topics]]
name = "sensors/+/telemetry"
entry_name = "telemetry"
content_type = "application/json"

[pipelines.ingest]
remote = "local"
inputs = ["main"]
`,
  },
  {
    value: "http",
    label: "HTTP",
    build: (store) => `${remoteHeader(store)}
[inputs.http.metrics_api]
url = "http://localhost:9000/metrics"
repeat_interval = 10
entry_name = "metrics"
content_type = "application/json"

[pipelines.ingest]
remote = "local"
inputs = ["metrics_api"]
`,
  },
  {
    value: "shell",
    label: "Shell",
    build: (store) => `${remoteHeader(store)}
[inputs.shell.uptime]
repeat_interval = 10
command = "uptime"
entry_name = "uptime"
content_type = "text/plain"

[pipelines.ingest]
remote = "local"
inputs = ["uptime"]
`,
  },
];

export const presetForVariant = (variant) => {
  if (/^ros2/.test(variant || "")) return "ros2";
  if (variant === "ros1") return "ros1";
  return "mqtt";
};

export const renderPreset = (preset, store, variant) => {
  const found = PRESETS.find((p) => p.value === preset);
  return found ? found.build(store, variant) : "";
};

const stripDynamic = (toml) =>
  (toml || "")
    .replace(/^url = "http:\/\/127\.0\.0\.1:\d+"$/gm, 'url = ""')
    .replace(/^token_api = ".*"$/gm, 'token_api = ""')
    .replace(/^bucket = ".*"$/gm, 'bucket = ""')
    .trim();

export const isPresetToml = (toml, store, variant) => {
  if (!toml?.trim()) return true;
  const stripped = stripDynamic(toml);
  return PRESETS.some(
    (p) => stripDynamic(p.build(store, variant)) === stripped,
  );
};

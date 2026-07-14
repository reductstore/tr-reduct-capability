export const BRIDGE_IMAGES = [
  { value: "reduct/bridge:latest-ros2-jazzy", label: "ROS 2 (Jazzy)" },
  { value: "reduct/bridge:latest-ros2-humble", label: "ROS 2 (Humble)" },
  { value: "reduct/bridge:latest-ros1", label: "ROS 1" },
  { value: "reduct/bridge:latest-iot", label: "IoT: MQTT / HTTP / Shell" },
];

const remoteHeader = (
  store,
) => `# ReductBridge config: https://www.reduct.store/docs/reduct-bridge
# Destination: the ReductStore running on this robot.
[remotes.reduct.local]
url = "http://127.0.0.1:${store?.httpPort ?? 8383}"
token_api = "${store?.apiToken ?? "transitive-local-token"}"
bucket = "${store?.bucket?.name ?? "robot-data"}"
prefix = "bridge/"
`;

const ros2Distro = (image) => {
  const m = /ros2-([a-z]+)/i.exec(image || "");
  return m ? m[1].toLowerCase() : "jazzy";
};

export const BRIDGE_TEMPLATES = [
  {
    label: "ROS 2",
    build: (store, image) => `${remoteHeader(store)}
# A ROS 2 input. Add more [inputs.ros2.<name>] sections for more sources.
[inputs.ros2.ros2_local]
node_name = "reduct_bridge"
queue_size = 128
domain_id = 0
schema_paths = ["/opt/ros/${ros2Distro(image)}"]

[[inputs.ros2.ros2_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros2_local"]
`,
  },
  {
    label: "ROS 1",
    build: (store) => `${remoteHeader(store)}
# A ROS 1 input. Needs a running roscore.
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
    label: "MQTT",
    build: (store) => `${remoteHeader(store)}
# An MQTT input. Set a password via the bridge Extra env vars if needed.
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
    label: "HTTP",
    build: (store) => `${remoteHeader(store)}
# An HTTP polling input.
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
    label: "Shell",
    build: (store) => `${remoteHeader(store)}
# A shell input: runs a command on an interval and stores its output.
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

export const templateForImage = (image) => {
  if (/ros2/i.test(image))
    return BRIDGE_TEMPLATES.find((t) => t.label === "ROS 2");
  if (/ros1/i.test(image))
    return BRIDGE_TEMPLATES.find((t) => t.label === "ROS 1");
  if (/iot|mqtt/i.test(image))
    return BRIDGE_TEMPLATES.find((t) => t.label === "MQTT");
  return null;
};

const stripDynamic = (t) =>
  (t || "")
    .replace(/^url = "http:\/\/127\.0\.0\.1:\d+"$/gm, 'url = ""')
    .replace(/^token_api = ".*"$/gm, 'token_api = ""')
    .replace(/^bucket = ".*"$/gm, 'bucket = ""')
    .trim();

const matchingTemplate = (toml, store, image) =>
  BRIDGE_TEMPLATES.find(
    (t) => stripDynamic(t.build(store, image)) === stripDynamic(toml),
  );

export const isTemplateToml = (toml, store, image) =>
  !toml?.trim() || !!matchingTemplate(toml, store, image);

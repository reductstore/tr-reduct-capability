function quoted(value) {
  return JSON.stringify(String(value));
}

function remoteHeader(store) {
  return `[remotes.reduct.local]
url = ${quoted(`http://127.0.0.1:${store?.httpPort ?? 8383}`)}
token_api = ${quoted(store?.apiToken ?? "transitive-local-token")}
bucket = ${quoted(store?.bucket?.name ?? "robot-data")}
prefix = "bridge/"
`;
}

function ros2Distro(variant) {
  return variant === "ros2-humble" ? "humble" : "jazzy";
}

const PRESETS = {
  ros2(store, variant) {
    return `${remoteHeader(store)}
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
`;
  },
  ros1(store) {
    return `${remoteHeader(store)}
[inputs.ros.ros_local]
uri = "http://localhost:11311"
node_name = "reduct_bridge"
queue_size = 128

[[inputs.ros.ros_local.topics]]
name = "/rosout"

[pipelines.ingest]
remote = "local"
inputs = ["ros_local"]
`;
  },
  mqtt(store) {
    return `${remoteHeader(store)}
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
`;
  },
  http(store) {
    return `${remoteHeader(store)}
[inputs.http.metrics_api]
url = "http://localhost:9000/metrics"
repeat_interval = 10
entry_name = "metrics"
content_type = "application/json"

[pipelines.ingest]
remote = "local"
inputs = ["metrics_api"]
`;
  },
  shell(store) {
    return `${remoteHeader(store)}
[inputs.shell.uptime]
repeat_interval = 10
command = "uptime"
entry_name = "uptime"
content_type = "text/plain"

[pipelines.ingest]
remote = "local"
inputs = ["uptime"]
`;
  },
};

function renderPreset(preset, store, variant) {
  const build = PRESETS[preset];
  if (!build) throw new Error(`Unsupported ReductBridge preset: ${preset}`);
  return build(store, variant);
}

module.exports = { PRESETS, renderPreset };

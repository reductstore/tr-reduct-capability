"use strict";

const DEFAULTS = {
  store: {
    image: "reductstore/reductstore:latest",
    containerName: "reductstore",
    httpPort: 8383,
    dataPath: "/tmp/reductstore-data",
    authEnabled: true,
    apiToken: "transitive-local-token",
  },
  bridge: {
    enabled: true,
    command: "reduct-bridge",
    configPath: "/tmp/tr-reduct-capability/reduct-bridge.toml",
    logPath: "/tmp/tr-reduct-capability/reduct-bridge.log",
    pidPath: "/tmp/tr-reduct-capability/reduct-bridge.pid",
    rosHome: "/tmp/tr-reduct-capability/.ros",
    remoteName: "local",
    bucket: "robot-data",
    prefix: "ros/",
    batchMaxRecords: 80,
    batchMaxSizeBytes: 8388608,
    batchMaxIntervalMs: 1000,
  },
  ros1: {
    enabled: false,
    inputName: "ros1_local",
    uri: "http://127.0.0.1:11311",
    nodeName: "reduct_bridge_ros1",
    queueSize: 128,
    topics: [],
  },
  ros2: {
    enabled: false,
    inputName: "ros2_local",
    domainId: 0,
    nodeName: "reduct_bridge_ros2",
    queueSize: 128,
    schemaPaths: [],
    topics: [],
  },
  boot: {
    autoStartStore: true,
    autoStartBridge: true,
  },
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function normalizeTopic(topic) {
  if (!topic || typeof topic !== "object") return null;
  const normalized = { name: topic.name };
  if (topic.entryName) normalized.entryName = topic.entryName;
  if (Array.isArray(topic.labels) && topic.labels.length > 0)
    normalized.labels = topic.labels;
  return normalized;
}

function getEnabledInputs(config) {
  const inputs = [];
  if (
    config?.ros1?.enabled &&
    Array.isArray(config.ros1.topics) &&
    config.ros1.topics.length > 0
  ) {
    inputs.push({
      type: "ros",
      name: config.ros1.inputName,
      nodeName: config.ros1.nodeName,
      queueSize: config.ros1.queueSize,
      uri: config.ros1.uri,
      topics: config.ros1.topics.map(normalizeTopic).filter(Boolean),
    });
  }

  if (
    config?.ros2?.enabled &&
    Array.isArray(config.ros2.topics) &&
    config.ros2.topics.length > 0
  ) {
    inputs.push({
      type: "ros2",
      name: config.ros2.inputName,
      nodeName: config.ros2.nodeName,
      queueSize: config.ros2.queueSize,
      domainId: config.ros2.domainId,
      schemaPaths: config.ros2.schemaPaths || [],
      topics: config.ros2.topics.map(normalizeTopic).filter(Boolean),
    });
  }

  return inputs.filter((input) => input.topics.length > 0);
}

function hasBridgeInputs(config) {
  return getEnabledInputs(config).length > 0;
}

function stringifyValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return `[${value.map((item) => stringifyValue(item)).join(", ")}]`;
  if (value && typeof value === "object") {
    const parts = Object.entries(value).map(
      ([key, entry]) => `${key} = ${stringifyValue(entry)}`,
    );
    return `{ ${parts.join(", ")} }`;
  }
  return '""';
}

function renderTopic(sectionPath, topic) {
  const lines = [
    `[[${sectionPath}.topics]]`,
    `name = ${stringifyValue(topic.name)}`,
  ];
  if (topic.entryName)
    lines.push(`entry_name = ${stringifyValue(topic.entryName)}`);
  if (Array.isArray(topic.labels) && topic.labels.length > 0) {
    lines.push(`labels = ${stringifyValue(topic.labels)}`);
  }
  return lines.join("\n");
}

function renderInput(input) {
  const sectionPath = `inputs.${input.type}.${input.name}`;
  const lines = [
    `[${sectionPath}]`,
    `node_name = ${stringifyValue(input.nodeName)}`,
    `queue_size = ${input.queueSize}`,
  ];

  if (input.type === "ros")
    lines.splice(1, 0, `uri = ${stringifyValue(input.uri)}`);
  if (input.type === "ros2") {
    lines.push(`domain_id = ${input.domainId}`);
    if (Array.isArray(input.schemaPaths) && input.schemaPaths.length > 0) {
      lines.push(`schema_paths = ${stringifyValue(input.schemaPaths)}`);
    }
  }

  for (const topic of input.topics) {
    lines.push("", renderTopic(sectionPath, topic));
  }

  return lines.join("\n");
}

function generateBridgeConfig(config) {
  const bridgeInputs = getEnabledInputs(config);
  if (!config?.bridge?.enabled || bridgeInputs.length === 0) return "";

  const lines = [
    "[[remotes.reduct]]",
    `name = ${stringifyValue(config.bridge.remoteName)}`,
    `url = ${stringifyValue(`http://127.0.0.1:${config.store.httpPort}`)}`,
    `token_api = ${stringifyValue(config.store.apiToken)}`,
    `bucket = ${stringifyValue(config.bridge.bucket)}`,
    `prefix = ${stringifyValue(config.bridge.prefix)}`,
    `batch_max_records = ${config.bridge.batchMaxRecords}`,
    `batch_max_size_bytes = ${config.bridge.batchMaxSizeBytes}`,
    `batch_max_interval_ms = ${config.bridge.batchMaxIntervalMs}`,
  ];

  for (const input of bridgeInputs) {
    lines.push("", renderInput(input));
  }

  lines.push(
    "",
    "[pipelines.ros_ingest]",
    `remote = ${stringifyValue(config.bridge.remoteName)}`,
    `inputs = ${stringifyValue(bridgeInputs.map((input) => input.name))}`,
  );

  return `${lines.join("\n")}\n`;
}

module.exports = {
  DEFAULTS,
  cloneDefaults,
  generateBridgeConfig,
  getEnabledInputs,
  hasBridgeInputs,
};

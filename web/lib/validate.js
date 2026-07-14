const REP_REQUIRED = {
  name: "name",
  srcBucket: "source bucket",
  dstBucket: "dest bucket",
  dstHost: "dest host",
};

export const isSet = (v) => v != null && String(v).trim() !== "";

export const validateConfig = (c) => {
  const issues = [];
  const s = c.store || {};
  if (!isSet(s.image)) issues.push("Store: image is required");
  if (!isSet(s.httpPort)) issues.push("Store: HTTP port is required");
  if (!isSet(s.dataPath)) issues.push("Store: data path is required");
  if (!isSet(s.apiToken)) issues.push("Store: API token is required");
  if (!isSet(s.bucket?.name)) issues.push("Store: bucket name is required");
  if (c.bridge?.enabled && !isSet(c.bridge.image))
    issues.push("Bridge: image is required when enabled");
  const reps = s.replications || [];
  reps.forEach((r, i) => {
    const who = isSet(r.name) ? `"${r.name}"` : `#${i + 1}`;
    for (const [k, label] of Object.entries(REP_REQUIRED))
      if (!isSet(r[k])) issues.push(`Replication ${who}: ${label} is required`);
    if (isSet(r.name) && reps.some((o, j) => j !== i && o.name === r.name))
      issues.push(`Replication ${who}: name must be unique`);
  });
  return issues;
};

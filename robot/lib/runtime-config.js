'use strict';

const { validateRuntimeConfigPatch } = require('./commands');

function applyRuntimeConfigUpdate(config, key, value, logger) {
  const field = (key || '').split('/').filter(Boolean).pop();
  if (!field || field === 'runtime') return { applied: false, reason: 'root' };
  if (!validateRuntimeConfigPatch(field, value)) {
    logger?.warn?.(`invalid runtime config ignored: ${field}`);
    return { applied: false, reason: 'invalid', field };
  }
  config[field] = value;
  return { applied: true, field };
}

module.exports = { applyRuntimeConfigUpdate };

'use strict';

const { validateRuntimeConfigPatch } = require('./commands');
const { DEFAULTS, cloneDefaults } = require('./bridge-config');

function setNestedValue(target, segments, value) {
  const pathSegments = segments.slice();
  if (pathSegments.length === 1 && Object.hasOwn(DEFAULTS.store, pathSegments[0])) {
    pathSegments.unshift('store');
  }

  if (
    pathSegments.length === 1 &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    target[pathSegments[0]] &&
    typeof target[pathSegments[0]] === 'object' &&
    !Array.isArray(target[pathSegments[0]])
  ) {
    Object.assign(target[pathSegments[0]], value);
    return;
  }

  let cursor = target;
  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[pathSegments[pathSegments.length - 1]] = value;
}

function applyRuntimeConfigUpdate(config, key, value, logger) {
  const segments = (key || '').split('/').filter(Boolean);
  const runtimeIndex = segments.indexOf('runtime');
  const pathSegments = runtimeIndex >= 0 ? segments.slice(runtimeIndex + 1) : segments;
  if (pathSegments.length === 0) return { applied: false, reason: 'root' };

  if (!validateRuntimeConfigPatch(pathSegments, value)) {
    logger?.warn?.(`invalid runtime config ignored: ${pathSegments.join('.')}`);
    return { applied: false, reason: 'invalid', field: pathSegments.join('.') };
  }
  setNestedValue(config, pathSegments, value);
  return { applied: true, field: pathSegments.join('.') };
}

module.exports = {
  DEFAULT_CONFIG: DEFAULTS,
  applyRuntimeConfigUpdate,
  cloneRuntimeConfig: cloneDefaults
};

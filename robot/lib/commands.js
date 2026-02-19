'use strict';

const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart']);

function extractActionFromKey(key) {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split('/').filter(Boolean);
  const idx = parts.indexOf('commands');
  if (idx < 0 || idx + 1 >= parts.length) return null;
  const action = parts[idx + 1];
  return ALLOWED_ACTIONS.has(action) ? action : null;
}

function validateRuntimeConfigPatch(field, value) {
  const validators = {
    image: (v) => typeof v === 'string' && v.length > 0,
    containerName: (v) => typeof v === 'string' && /^[a-zA-Z0-9_.-]+$/.test(v),
    httpPort: (v) => Number.isInteger(v) && v > 0 && v < 65536,
    dataPath: (v) => typeof v === 'string' && v.startsWith('/'),
    authEnabled: (v) => typeof v === 'boolean'
  };

  if (!validators[field]) return false;
  return validators[field](value);
}

module.exports = {
  ALLOWED_ACTIONS,
  extractActionFromKey,
  validateRuntimeConfigPatch
};

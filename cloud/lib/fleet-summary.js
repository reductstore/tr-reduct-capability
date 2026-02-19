'use strict';

function computeFleetSummary(root, fullName) {
  let running = 0;
  let error = 0;

  for (const org of Object.values(root || {})) {
    for (const device of Object.values(org || {})) {
      const state = device?.[fullName]?.device?.status?.state;
      if (state === 'running') running += 1;
      if (state === 'error') error += 1;
    }
  }

  return { runningCount: running, errorCount: error };
}

module.exports = { computeFleetSummary };

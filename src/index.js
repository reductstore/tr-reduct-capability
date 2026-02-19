'use strict';

/**
 * Minimal bootstrap for Transitive Robotics ReductStore capability.
 * This is intentionally tiny to validate repo workflow (branch + commit + push).
 */

function main() {
  console.log('tr-reduct-capability bootstrap: ready');
}

if (require.main === module) {
  main();
}

module.exports = { main };

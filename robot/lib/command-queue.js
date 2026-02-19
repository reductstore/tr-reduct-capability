'use strict';

function createCommandQueue(executor) {
  let queue = Promise.resolve();

  return function enqueue(action, payload) {
    queue = queue.catch(() => {}).then(() => executor(action, payload));
    return queue;
  };
}

module.exports = { createCommandQueue };

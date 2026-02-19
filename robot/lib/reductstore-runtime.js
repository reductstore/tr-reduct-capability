'use strict';

const { execFile } = require('node:child_process');

const DEFAULTS = {
  image: 'reductstore/reductstore:latest',
  containerName: 'reductstore',
  httpPort: 8383,
  dataPath: '/tmp/reductstore-data',
  authEnabled: false,
  apiToken: ''
};

function sh(command, args = []) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve((stdout || '').trim());
    });
  });
}

function buildRunArgs(config) {
  const args = [
    'run', '-d',
    '--name', config.containerName,
    '-p', `${config.httpPort}:8383`,
    '-v', `${config.dataPath}:/data`
  ];

  if (config.authEnabled && config.apiToken) {
    args.push('-e', `RS_API_TOKEN=${config.apiToken}`);
  }

  args.push(config.image);
  return args;
}

async function start(config = {}, runner = sh) {
  const c = { ...DEFAULTS, ...config };
  await runner('docker', ['rm', '-f', c.containerName]).catch(() => {});
  await runner('docker', buildRunArgs(c));
  return status(c, runner);
}

async function stop(config = {}, runner = sh) {
  const c = { ...DEFAULTS, ...config };
  await runner('docker', ['rm', '-f', c.containerName]).catch(() => {});
  return { state: 'stopped', containerName: c.containerName };
}

async function restart(config = {}, runner = sh) {
  await stop(config, runner);
  return start(config, runner);
}

async function status(config = {}, runner = sh) {
  const c = { ...DEFAULTS, ...config };
  const out = await runner('docker', [
    'ps',
    '--filter', `name=^/${c.containerName}$`,
    '--format', '{{.ID}}|{{.Status}}|{{.Image}}|{{.Ports}}'
  ]).catch(() => '');

  if (!out) {
    return { state: 'stopped', containerName: c.containerName, alive: false };
  }

  const [id, dockerStatus, image, ports] = out.split('|');
  return {
    state: 'running',
    containerId: id,
    dockerStatus,
    image,
    ports,
    alive: true
  };
}

module.exports = {
  DEFAULTS,
  buildRunArgs,
  start,
  stop,
  restart,
  status
};

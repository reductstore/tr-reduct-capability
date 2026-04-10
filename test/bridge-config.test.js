'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cloneDefaults, generateBridgeConfig, hasBridgeInputs } = require('../robot/lib/bridge-config');

test('hasBridgeInputs is false until ROS topics are configured', () => {
  const config = cloneDefaults();
  assert.equal(hasBridgeInputs(config), false);
  config.ros1.enabled = true;
  config.ros1.topics = [{ name: '/chatter' }];
  assert.equal(hasBridgeInputs(config), true);
});

test('generateBridgeConfig renders ROS1 and ROS2 inputs into one pipeline', () => {
  const config = cloneDefaults();
  config.store.httpPort = 8484;
  config.store.apiToken = 'secret';
  config.bridge.bucket = 'fleet';
  config.ros1.enabled = true;
  config.ros1.topics = [{ name: '/imu', entryName: 'imu' }];
  config.ros2.enabled = true;
  config.ros2.schemaPaths = ['/opt/ros/jazzy'];
  config.ros2.topics = [{ name: '/camera/image_raw', labels: [{ static: { source: 'front' } }] }];

  const rendered = generateBridgeConfig(config);

  assert.match(rendered, /\[\[remotes\.reduct\]\]/);
  assert.match(rendered, /url = "http:\/\/127\.0\.0\.1:8484"/);
  assert.match(rendered, /bucket = "fleet"/);
  assert.match(rendered, /\[inputs\.ros\.ros1_local\]/);
  assert.match(rendered, /\[inputs\.ros2\.ros2_local\]/);
  assert.match(rendered, /schema_paths = \["\/opt\/ros\/jazzy"\]/);
  assert.match(rendered, /inputs = \["ros1_local", "ros2_local"\]/);
});

test('generateBridgeConfig returns empty when bridge is disabled', () => {
  const config = cloneDefaults();
  config.bridge.enabled = false;
  config.ros1.enabled = true;
  config.ros1.topics = [{ name: '/chatter' }];
  assert.equal(generateBridgeConfig(config), '');
});

'use strict';

const { Capability, getLogger } = require('@transitive-sdk/utils');
const { computeFleetSummary } = require('./lib/fleet-summary');

const log = getLogger('reductstore-cloud');
log.setLevel(process.env.LOG_LEVEL || 'info');

class CloudCapability extends Capability {
  constructor() {
    super(() => {
      this.mqttSync.subscribe(`/+/+/${this.fullName}/device/status`);
      this.mqttSync.publish(`/+/+/${this.fullName}/cloud/fleet`);

      this.data.subscribePath(`/+org/+device/${this.fullName}/device/status/state`, () => {
        this.publishFleetSummary();
      });

      setInterval(() => this.publishFleetSummary(), 10000);
      log.info(`cloud capability started: ${this.fullName}`);
    });
  }

  publishFleetSummary() {
    const root = this.data.get() || {};
    const { runningCount, errorCount } = computeFleetSummary(root, this.fullName);

    this.data.update(`/cloud/fleet/runningCount`, runningCount);
    this.data.update(`/cloud/fleet/errorCount`, errorCount);
    this.data.update(`/cloud/fleet/updatedAt`, Date.now());
  }
}

new CloudCapability();

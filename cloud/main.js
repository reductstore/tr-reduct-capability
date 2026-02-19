'use strict';

const { Capability, getLogger } = require('@transitive-sdk/utils');

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
    let running = 0;
    let error = 0;

    for (const org of Object.values(root)) {
      for (const device of Object.values(org || {})) {
        const state = device?.[this.fullName]?.device?.status?.state;
        if (state === 'running') running += 1;
        if (state === 'error') error += 1;
      }
    }

    this.data.update(`/cloud/fleet/runningCount`, running);
    this.data.update(`/cloud/fleet/errorCount`, error);
    this.data.update(`/cloud/fleet/updatedAt`, Date.now());
  }
}

new CloudCapability();

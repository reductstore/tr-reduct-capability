"use strict";

const { Capability, getLogger } = require("@transitive-sdk/utils");
const { computeFleetSummary } = require("./lib/fleet-summary");

const log = getLogger("reductstore-cloud");
log.setLevel(process.env.LOG_LEVEL || "info");

class CloudCapability extends Capability {
  constructor() {
    super(() => {
      this.mqttSync.subscribe(`/+/+/${this.fullName}/device/status`);
      this.mqttSync.subscribe(`/+/+/${this.fullName}/device/runtime`);
      this.mqttSync.publish(`/+/+/${this.fullName}/cloud/fleet`);

      this.data.subscribePath(
        `/+org/+device/${this.fullName}/device/status/state`,
        () => {
          this.publishFleetSummary();
        },
      );

      this.data.subscribePath(
        `/+org/+device/${this.fullName}/device/runtime/store/state`,
        () => {
          this.publishFleetSummary();
        },
      );

      this.data.subscribePath(
        `/+org/+device/${this.fullName}/device/runtime/bridge/state`,
        () => {
          this.publishFleetSummary();
        },
      );

      setInterval(() => this.publishFleetSummary(), 10000);
      log.info(`cloud capability started: ${this.fullName}`);
    });
  }

  publishFleetSummary() {
    const root = this.data.get() || {};
    const summary = computeFleetSummary(root, this.fullName);

    this.data.update("/cloud/fleet/runningCount", summary.runningCount);
    this.data.update("/cloud/fleet/errorCount", summary.errorCount);
    this.data.update("/cloud/fleet/stoppedCount", summary.stoppedCount);
    this.data.update("/cloud/fleet/store", summary.store);
    this.data.update("/cloud/fleet/bridge", summary.bridge);
    this.data.update("/cloud/fleet/ingestion", summary.ingestion);
    this.data.update("/cloud/fleet/updatedAt", Date.now());
  }
}

new CloudCapability();

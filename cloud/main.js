const { Capability, getLogger } = require("@transitive-sdk/utils");
const { computeFleetSummary } = require("./lib/fleet-summary");

const log = getLogger("reductstore-cloud");
log.setLevel(process.env.LOG_LEVEL || "info");

class CloudCapability extends Capability {
  constructor() {
    super(() => {
      this.mqttSync.subscribe(`/+/+/${this.fullName}/device`);
      this.mqttSync.publish(`/+/+/${this.fullName}/cloud/fleet`);

      this.data.subscribePath(
        `/+org/+device/${this.fullName}/device/state`,
        () => this.publishFleet(),
      );

      setInterval(() => this.publishFleet(), 10000);
      log.info(`cloud capability started: ${this.fullName}`);
    });
  }

  publishFleet() {
    const root = this.data.get() || {};
    const parts = this.fullName.split("/");
    for (const [org, devices] of Object.entries(root)) {
      const summary = computeFleetSummary(devices, parts);
      for (const [key, value] of Object.entries(summary)) {
        this.data.update(`/${org}/_fleet/${this.fullName}/cloud/fleet/${key}`, value);
      }
      this.data.update(`/${org}/_fleet/${this.fullName}/cloud/fleet/updatedAt`, Date.now());
    }
  }
}

new CloudCapability();

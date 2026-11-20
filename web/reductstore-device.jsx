import React, { useEffect, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { createWebComponent, useTransitive } from "@transitive-sdk/utils-web";
import { validateConfig } from "./lib/validate";
import { StoreSection, BridgeSection, ControlBar } from "./lib/sections";

const [, capabilityName] = TR_PKG_NAME.split("/");

const Device = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, prefixVersion, prefixPathVersion } = useTransitive({
    jwt,
    id,
    host,
    ssl,
    capability: TR_PKG_NAME,
    versionNS: TR_PKG_VERSION_NS,
  });

  const [cfg, setCfg] = useState(null);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/device`);
    mqttSync.publish(`${prefixVersion}/commands`);
    mqttSync.publish(`${prefixVersion}/config`);
  }, [mqttSync, prefixVersion]);

  const device =
    [...prefixPathVersion, "device"].reduce(
      (value, key) => (value == null ? value : value[key]),
      data,
    ) || {};
  const remoteJson = device.config?.json;

  useEffect(() => {
    if (remoteJson && !cfg) {
      try {
        setCfg(JSON.parse(remoteJson));
      } catch {
        // ignore malformed
      }
    }
  }, [remoteJson]);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const sendCommand = (action, config) => {
    if (!mqttSync) return;
    mqttSync.data.update(
      `${prefixVersion}/commands/request`,
      JSON.stringify({
        action,
        config,
        requestId: String(Date.now()),
        ts: Date.now(),
      }),
    );
  };
  const control = (action) => {
    sendCommand(action);
  };
  const apply = (action, nextCfg = cfg) => {
    setCfg(nextCfg);
    sendCommand(action, nextCfg);
  };
  const discardAll = () => {
    if (!remote) return;
    setCfg(remote);
  };

  const remote = (() => {
    try {
      return remoteJson ? JSON.parse(remoteJson) : null;
    } catch {
      return null;
    }
  })();
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  const storeDirty = !!cfg && !!remote && differs(cfg.store, remote.store);
  const bridgeDirty = !!cfg && !!remote && differs(cfg.bridge, remote.bridge);
  const issues = cfg ? validateConfig(cfg) : [];

  const billingValid = device.billing?.state === "valid";
  const storeRunning = !!device.store?.running;
  const bridgeRunning = !!device.bridge?.running;
  const bridgeEnabled = !!(remote || cfg)?.bridge?.enabled;
  const canStart = !storeRunning || (bridgeEnabled && !bridgeRunning);
  const canStop = storeRunning || bridgeRunning;

  return (
    <div>
      {!billingValid && (
        <Alert variant="danger" className="py-2">
          Billing is invalid. Controls stay disabled until a valid billing token
          arrives.
        </Alert>
      )}

      {!cfg ? (
        <div className="text-secondary d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          {waited ? (
            <span>
              The device has not reported its configuration yet. Make sure the
              capability is running on the robot.{" "}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() =>
                  mqttSync && mqttSync.subscribe(`${prefixVersion}/device`)
                }
              >
                Retry
              </Button>
            </span>
          ) : (
            <span>Loading configuration…</span>
          )}
        </div>
      ) : (
        <>
          <StoreSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={storeDirty}
            dev={device}
            remote={remote}
          />
          <BridgeSection
            cfg={cfg}
            setCfg={setCfg}
            dirty={bridgeDirty}
            dev={device}
          />
          <ControlBar
            dirty={storeDirty || bridgeDirty}
            issues={issues}
            billingValid={billingValid}
            canStart={canStart}
            canStop={canStop}
            onControl={control}
            onApply={() => apply("restart")}
            onDiscard={discardAll}
          />
        </>
      )}
    </div>
  );
};

createWebComponent(Device, `${capabilityName}-device`, TR_PKG_VERSION);

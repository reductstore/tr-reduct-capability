import React, { useEffect } from 'react';
import { createWebComponent, useTransitive } from '@transitive-sdk/utils-web';

const [scope, capabilityName] = TR_PKG_NAME.split('/');

const Device = ({ jwt, id, host, ssl }) => {
  const { mqttSync, data, StatusComponent, prefixVersion } = useTransitive({
    jwt,
    id,
    host,
    ssl,
    capability: TR_PKG_NAME,
    versionNS: TR_PKG_VERSION_NS
  });

  useEffect(() => {
    if (!mqttSync) return;
    mqttSync.subscribe(`${prefixVersion}/device`);
  }, [mqttSync, prefixVersion]);

  const send = (action) => {
    if (!mqttSync) return;
    mqttSync.data.update(`${prefixVersion}/commands/${action}`, {
      requestId: `${Date.now()}`,
      actor: 'ui',
      ts: Date.now()
    });
  };

  const state = data?.device?.status?.state || 'unknown';
  const alive = data?.device?.health?.alive ? 'alive' : 'down';

  return <div>
    <StatusComponent />
    <h4>{capabilityName} status</h4>
    <p>state: <b>{state}</b> / health: <b>{alive}</b></p>
    <button onClick={() => send('start')}>Start</button>
    <button onClick={() => send('stop')}>Stop</button>
    <button onClick={() => send('restart')}>Restart</button>
  </div>;
};

createWebComponent(Device, `${capabilityName}-device`, ['jwt']);

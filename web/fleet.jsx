import React from 'react';
import { createWebComponent } from '@transitive-sdk/utils-web';

const [scope, capabilityName] = TR_PKG_NAME.split('/');

const Fleet = () => {
  return <div>
    <h4>{capabilityName} fleet</h4>
    <p>Minimal fleet view is provided by cloud summary topics.</p>
  </div>;
};

createWebComponent(Fleet, `${capabilityName}-fleet`, ['jwt']);

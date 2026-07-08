const net = require("node:net");
const http = require("node:http");

async function startStandalone({ mqttPort = 1883, httpPort = 9080 } = {}) {
  let aedes;
  try {
    aedes = require("aedes")();
  } catch {
    throw new Error(
      "aedes is required for standalone mode. Install it with: npm install --save-dev aedes",
    );
  }

  const mqttServer = net.createServer(aedes.handle);
  await new Promise((resolve, reject) => {
    mqttServer.listen(mqttPort, (err) => (err ? reject(err) : resolve()));
  });

  const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        mode: "standalone",
        mqtt: `mqtt://localhost:${mqttPort}`,
        uptime: process.uptime(),
      }),
    );
  });

  await new Promise((resolve, reject) => {
    httpServer.listen(httpPort, (err) => (err ? reject(err) : resolve()));
  });

  return {
    mqttUrl: `mqtt://localhost:${mqttPort}`,
    httpPort,
    broker: aedes,
    mqttServer,
    httpServer,
    close() {
      aedes.close();
      mqttServer.close();
      httpServer.close();
    },
  };
}

module.exports = { startStandalone };

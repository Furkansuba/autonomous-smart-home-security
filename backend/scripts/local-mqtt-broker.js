const net = require('net');
const PORT = Number(process.env.LOCAL_MQTT_PORT || 1883);
async function main() {
  const { Aedes } = await import('aedes');
  const broker = await Aedes.createBroker();
  const server = net.createServer(broker.handle);
  broker.on('client', (client) => {
    console.log('[BROKER] client connected: ' + client.id);
  });
  broker.on('clientDisconnect', (client) => {
    console.log('[BROKER] client disconnected: ' + client.id);
  });
  broker.on('subscribe', (subscriptions, client) => {
    if (!client) {
      return;
    }
    const topics = subscriptions.map((item) => item.topic).join(', ');
    console.log('[BROKER] ' + client.id + ' subscribed to: ' + topics);
  });
  broker.on('publish', (packet, client) => {
    if (!client) {
      return;
    }
    console.log('[BROKER] message from ' + client.id + ' on ' + packet.topic);
  });
  server.listen(PORT, () => {
    console.log('[BROKER] local MQTT broker listening on port ' + PORT);
  });
}
main().catch((error) => {
  console.error('[BROKER] failed to start');
  console.error(error);
  process.exit(1);
});

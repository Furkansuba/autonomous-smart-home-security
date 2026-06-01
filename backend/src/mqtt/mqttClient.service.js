const mqtt = require('mqtt');
const { env } = require('../config/env');
let client = null;
const mqttState = {
  enabled: env.mqttEnabled,
  connected: false,
  broker_url: env.mqttBrokerUrl,
  client_id: env.mqttClientId,
  subscribed_topics: [],
  last_error: null,
  last_connected_at: null,
  last_disconnected_at: null,
};
function buildMqttOptions() {
  const options = {
    clientId: env.mqttClientId,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };
  if (env.mqttUsername) {
    options.username = env.mqttUsername;
  }
  if (env.mqttPassword) {
    options.password = env.mqttPassword;
  }
  return options;
}
function getMqttStatus() {
  return {
    ...mqttState,
  };
}
function attachClientHandlers(mqttClient, onMessage) {
  mqttClient.on('connect', () => {
    mqttState.connected = true;
    mqttState.last_error = null;
    mqttState.last_connected_at = new Date().toISOString();
  });
  mqttClient.on('reconnect', () => {
    mqttState.connected = false;
  });
  mqttClient.on('close', () => {
    mqttState.connected = false;
    mqttState.last_disconnected_at = new Date().toISOString();
  });
  mqttClient.on('error', (error) => {
    mqttState.connected = false;
    mqttState.last_error = error.message;
  });
  mqttClient.on('message', (topic, messageBuffer) => {
    if (typeof onMessage === 'function') {
      onMessage(topic, messageBuffer);
    }
  });
}
function subscribeTopics(mqttClient, topics) {
  return new Promise((resolve, reject) => {
    mqttClient.subscribe(topics, { qos: 0 }, (error, granted) => {
      if (error) {
        reject(error);
        return;
      }
      mqttState.subscribed_topics = granted.map((item) => item.topic);
      resolve(granted);
    });
  });
}
async function startMqttClient(onMessage) {
  if (!env.mqttEnabled) {
    return {
      started: false,
      skipped: true,
      reason: 'MQTT_ENABLED is false.',
      status: getMqttStatus(),
    };
  }
  if (client) {
    return {
      started: true,
      skipped: false,
      reason: 'MQTT client already exists.',
      status: getMqttStatus(),
    };
  }
  client = mqtt.connect(env.mqttBrokerUrl, buildMqttOptions());
  attachClientHandlers(client, onMessage);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        started: false,
        skipped: false,
        reason: 'MQTT connection timeout.',
        status: getMqttStatus(),
      });
    }, 12000);
    client.once('connect', async () => {
      clearTimeout(timeout);
      try {
        await subscribeTopics(client, env.mqttSubscribeTopics);
        resolve({
          started: true,
          skipped: false,
          status: getMqttStatus(),
        });
      } catch (error) {
        mqttState.last_error = error.message;
        resolve({
          started: false,
          skipped: false,
          reason: error.message,
          status: getMqttStatus(),
        });
      }
    });
    client.once('error', (error) => {
      clearTimeout(timeout);
      resolve({
        started: false,
        skipped: false,
        reason: error.message,
        status: getMqttStatus(),
      });
    });
  });
}
function publishMqttMessage(topic, payload, options = {}) {
  if (!client || !mqttState.connected) {
    return Promise.resolve({
      published: false,
      skipped: true,
      reason: 'mqtt_not_connected',
      topic,
      status: getMqttStatus(),
    });
  }
  const message =
    Buffer.isBuffer(payload) || typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);
  return new Promise((resolve) => {
    client.publish(
      topic,
      message,
      {
        qos: options.qos || 0,
        retain: options.retain || false,
      },
      (error) => {
        if (error) {
          mqttState.last_error = error.message;
          resolve({
            published: false,
            skipped: false,
            reason: 'mqtt_publish_error',
            error: error.message,
            topic,
            status: getMqttStatus(),
          });
          return;
        }
        resolve({
          published: true,
          skipped: false,
          topic,
          qos: options.qos || 0,
          retain: options.retain || false,
        });
      }
    );
  });
}
function stopMqttClient() {
  return new Promise((resolve) => {
    if (!client) {
      resolve({
        stopped: false,
        skipped: true,
        reason: 'MQTT client does not exist.',
        status: getMqttStatus(),
      });
      return;
    }
    client.end(false, {}, () => {
      client = null;
      mqttState.connected = false;
      mqttState.subscribed_topics = [];
      mqttState.last_disconnected_at = new Date().toISOString();
      resolve({
        stopped: true,
        skipped: false,
        status: getMqttStatus(),
      });
    });
  });
}
module.exports = {
  buildMqttOptions,
  getMqttStatus,
  startMqttClient,
  publishMqttMessage,
  stopMqttClient,
};

/*
 * esp32_heartbeat_step1.ino
 *
 * TEST SKETCH ONLY — standalone heartbeat integration test.
 *
 * WARNING:
 *   - Do NOT commit real credentials (Wi-Fi, MQTT host).
 *   - Do NOT paste raw RFID UIDs anywhere in this file.
 *   - Do NOT use this as final safety firmware.
 *   - This sketch has no sensor, relay, RFID, pump, or servo code.
 *
 * Purpose:
 *   Verify that the ESP32 can connect to Wi-Fi, sync NTP time,
 *   connect to the MQTT broker, and publish a valid esp32_home_01
 *   heartbeat payload every 30 seconds.
 *
 * Required libraries (install via Arduino Library Manager):
 *   - PubSubClient by Nick O'Leary
 *   - ArduinoJson by Benoit Blanchon
 *   - WiFi.h  (built-in ESP32 core)
 *   - time.h  (built-in)
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ── Config — fill in real values in secrets.h, NOT here ──────────
// Create secrets.h alongside this file and add secrets.h to .gitignore.
// #include "secrets.h"

#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"
#define MQTT_HOST         "ASK_SOFTWARE_TEAM_FOR_MQTT_HOST"
#define MQTT_PORT         1883
#define DEVICE_ID         "esp32_home_01"
#define FIRMWARE_VERSION  "heartbeat-step1-test"
#define HEARTBEAT_INTERVAL_MS  30000UL

// ── Globals ───────────────────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastHeartbeatMs = 0;

// ─────────────────────────────────────────────────────────────────
// connectWiFi
// ─────────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
    if (millis() - start > 15000) {
      Serial.println("\n[WiFi] Timeout — could not connect");
      return;
    }
  }
  Serial.println();
  Serial.print("[WiFi] Connected. IP: ");
  Serial.print(WiFi.localIP());
  Serial.print("  RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

// ─────────────────────────────────────────────────────────────────
// syncTime
// ─────────────────────────────────────────────────────────────────
void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("[NTP] Syncing time");
  time_t now = 0;
  unsigned long start = millis();
  while (now < 1000000000UL) {
    delay(200);
    Serial.print('.');
    time(&now);
    if (millis() - start > 10000) {
      Serial.println("\n[NTP] Timeout — timestamps may be incorrect");
      return;
    }
  }
  Serial.println("\n[NTP] Time synced");
}

// ─────────────────────────────────────────────────────────────────
// connectMqtt
// ─────────────────────────────────────────────────────────────────
void connectMqtt() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);
  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_HOST);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  if (mqtt.connect(DEVICE_ID)) {
    Serial.println("[MQTT] Connected");
  } else {
    Serial.print("[MQTT] Failed, state=");
    Serial.println(mqtt.state());
  }
}

// ─────────────────────────────────────────────────────────────────
// ensureMqttConnected — called every loop iteration
// ─────────────────────────────────────────────────────────────────
void ensureMqttConnected() {
  if (mqtt.connected()) return;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost connection — reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
    syncTime();
  }

  Serial.println("[MQTT] Reconnecting...");
  if (mqtt.connect(DEVICE_ID)) {
    Serial.println("[MQTT] Reconnected");
  } else {
    Serial.print("[MQTT] Reconnect failed, state=");
    Serial.println(mqtt.state());
  }
}

// ─────────────────────────────────────────────────────────────────
// isoTimestamp — returns UTC ISO-8601 string
// ─────────────────────────────────────────────────────────────────
String isoTimestamp() {
  time_t now;
  time(&now);
  struct tm *t = gmtime(&now);
  char buf[25];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
           t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

// ─────────────────────────────────────────────────────────────────
// publishHeartbeat
// ─────────────────────────────────────────────────────────────────
void publishHeartbeat() {
  StaticJsonDocument<256> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["status"]           = "online";
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["uptime_seconds"]   = (unsigned long)(millis() / 1000);
  doc["wifi_rssi"]        = (int)WiFi.RSSI();
  doc["timestamp"]        = isoTimestamp();

  char payload[256];
  serializeJson(doc, payload);

  const char* topic = "home/esp32_home_01/heartbeat";
  bool ok = mqtt.publish(topic, payload, /*retained=*/false);

  Serial.print("[HEARTBEAT] ");
  Serial.print(ok ? "OK    " : "FAIL  ");
  Serial.println(payload);
}

// ─────────────────────────────────────────────────────────────────
// setup
// ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Heartbeat Step 1 Test ===");

  connectWiFi();
  syncTime();
  connectMqtt();

  Serial.println("[SETUP] Init complete — entering loop");
}

// ─────────────────────────────────────────────────────────────────
// loop
// ─────────────────────────────────────────────────────────────────
void loop() {
  ensureMqttConnected();
  mqtt.loop();

  if (mqtt.connected() && (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS)) {
    lastHeartbeatMs = millis();
    publishHeartbeat();
  }

  delay(10);
}

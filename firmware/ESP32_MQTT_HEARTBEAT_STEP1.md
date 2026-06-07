# ESP32 MQTT Step 1 — Wi-Fi + Heartbeat Integration Template

**Purpose:** Add Wi-Fi, MQTT, and the `esp32_home_01` heartbeat to the existing `code-final` sketch.  
This is Step 1 only. Telemetry, event publishing, RFID hashing, and override subscribe come in later steps.  
Do not modify sensor, relay, or pump logic in this step.

---

## 1. Required Arduino libraries

Install via Arduino Library Manager or `platformio.ini` before compiling:

| Library | Purpose |
|---|---|
| `WiFi.h` | Built-in ESP32 Wi-Fi (no install needed) |
| `PubSubClient` by Nick O'Leary | MQTT client |
| `ArduinoJson` by Benoît Blanchon | JSON payload builder |
| `time.h` | Built-in POSIX time / NTP (no install needed) |

---

## 2. Placeholder config block

Add near the top of the sketch, alongside the existing pin constants.  
**Fill in real values in a `secrets.h` that is `.gitignore`d — never commit credentials.**

```cpp
// ── MQTT / Wi-Fi config ───────────────────────────────────────────
// Put real values in secrets.h and #include "secrets.h" here.
// Never commit secrets.h to the repository.
#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"
#define MQTT_HOST         "ASK_SOFTWARE_TEAM_FOR_MQTT_HOST"
#define MQTT_PORT         1883
#define DEVICE_ID         "esp32_home_01"
#define FIRMWARE_VERSION  "mch-step1-heartbeat"
#define HEARTBEAT_INTERVAL_MS  30000UL   // 30 seconds
```

Recommended `secrets.h` pattern (add `secrets.h` to `.gitignore`):

```cpp
// secrets.h — NOT committed to git
#define WIFI_SSID         "your_actual_ssid"
#define WIFI_PASSWORD     "your_actual_password"
#define MQTT_HOST         "actual.mqtt.host.or.ip"
```

---

## 3. Additional includes

Add at the top of the sketch, after existing includes:

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
// #include "secrets.h"   // uncomment when secrets.h is ready
```

---

## 4. Global client objects

Add after the config block, before `setup()`:

```cpp
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastHeartbeatMs = 0;
```

---

## 5. Functions to add

Paste these functions into the sketch before `setup()` (or in a separate `.ino` tab).

### connectWiFi()

```cpp
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
      Serial.println("\n[WiFi] Timeout — continuing without Wi-Fi");
      return;
    }
  }
  Serial.println();
  Serial.print("[WiFi] Connected, IP: ");
  Serial.println(WiFi.localIP());
}
```

### syncTime()

```cpp
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
```

### connectMqtt()

```cpp
void connectMqtt() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);
  Serial.print("[MQTT] Connecting to ");
  Serial.println(MQTT_HOST);
  if (mqtt.connect(DEVICE_ID)) {
    Serial.println("[MQTT] Connected");
  } else {
    Serial.print("[MQTT] Failed, state=");
    Serial.println(mqtt.state());
  }
}
```

### ensureMqttConnected()

```cpp
void ensureMqttConnected() {
  if (mqtt.connected()) return;
  if (WiFi.status() != WL_CONNECTED) {
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
```

### isoTimestamp()

```cpp
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
```

### publishHeartbeat()

```cpp
void publishHeartbeat() {
  StaticJsonDocument<256> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["status"]           = "online";
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["uptime_seconds"]   = millis() / 1000;
  doc["wifi_rssi"]        = WiFi.RSSI();
  doc["timestamp"]        = isoTimestamp();

  char payload[256];
  serializeJson(doc, payload);

  const char* topic = "home/esp32_home_01/heartbeat";
  bool ok = mqtt.publish(topic, payload, /*retained=*/false);
  Serial.print("[HEARTBEAT] published: ");
  Serial.print(ok ? "OK" : "FAIL");
  Serial.print("  ");
  Serial.println(payload);
}
```

---

## 6. MQTT heartbeat topic

```
home/esp32_home_01/heartbeat
```

---

## 7. Heartbeat payload

```json
{
  "device_id":        "esp32_home_01",
  "status":           "online",
  "firmware_version": "mch-step1-heartbeat",
  "uptime_seconds":   3600,
  "wifi_rssi":        -55,
  "timestamp":        "2026-06-07T10:00:00Z"
}
```

All fields are required. The backend rejects payloads missing any field.

---

## 8. Integration instructions for code-final

### 8a. setup() additions

In `setup()`, after `Serial.begin(...)` and before the main sensor initialisation block:

```cpp
connectWiFi();
syncTime();
connectMqtt();
```

### 8b. loop() additions

In `loop()`, after the watchdog reset / timer pet and before or after the sensor read block — **do not place inside a blocking delay**:

```cpp
// ── MQTT keep-alive ──────────────────────────────────────────────
ensureMqttConnected();
mqtt.loop();

// ── Heartbeat every 30 s ─────────────────────────────────────────
if (mqtt.connected() && (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS)) {
  lastHeartbeatMs = millis();
  publishHeartbeat();
}
```

### 8c. What to leave untouched in this step

- All sensor read logic (DHT, MQ-2, MQ-7, flame, PIR, impact, reed)
- All relay / pump activation logic
- All RFID UID read logic
- All existing Serial debug output
- Watchdog timer reset calls

---

## 9. RFID safety note (Step 1)

Do not add any RFID publishing logic in this step.  
When RFID is integrated in a later step, send only the SHA-256 hash of the UID:

```
card_uid_hash: "sha256:<hex-digest>"
```

**Raw RFID UIDs must never be committed to the repository or transmitted over MQTT.**

---

## 10. Testing checklist

Work through these in order before moving to Step 2:

- [ ] Serial monitor shows `[WiFi] Connected, IP: ...`
- [ ] Serial monitor shows `[NTP] Time synced`
- [ ] Serial monitor shows `[MQTT] Connected`
- [ ] Serial monitor shows `[HEARTBEAT] published: OK  {"device_id":"esp32_home_01",...}` every ~30 seconds
- [ ] `GET /api/devices` (via Postman or curl) returns `esp32_home_01` with `"status": "online"`
- [ ] Android Devices screen (pull-to-refresh or 30 s auto-refresh) shows `esp32_home_01` **Online**
- [ ] Admin Web Devices panel shows `esp32_home_01` **Online**
- [ ] Wait 90 seconds with ESP32 powered off → backend marks `esp32_home_01` **Offline**
- [ ] Restart ESP32 → status returns to **Online** within one heartbeat interval (~30 s)

---

## 11. Step 2 preview (do not implement yet)

After Step 1 passes the checklist above, Step 2 adds telemetry snapshots:

```
home/esp32_home_01/telemetry
```

Payload will include DHT temperature/humidity, gas raw ADC values, and component statuses.  
Full schema is in `firmware/FIRMWARE_CONTRACT.md §6`.

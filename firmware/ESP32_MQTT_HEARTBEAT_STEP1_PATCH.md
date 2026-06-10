# ESP32 MQTT Heartbeat — Step 1 Patch Guide for code-final

**Scope:** Wi-Fi connect + NTP sync + MQTT connect + `esp32_home_01` heartbeat every 30 s.  
**Does NOT add:** telemetry, event publishing, RFID hash, override subscribe, component heartbeats.  
**Does NOT change:** sensor read logic, relay/pump interlock, gas/CO/fire safety logic, RFID UID handling, watchdog timer, relay HIGH/LOW semantics.

---

## Safety warnings — read before touching anything

- Do **not** edit the raw RFID UID constant list. Do not rename, remove, or reorder it.
- Do **not** commit raw UID values. Do not transmit them over MQTT.
- Do **not** modify pump activation logic, gas/CO lockout, or fire-interlock conditions.
- Do **not** change the watchdog timer period or omit the watchdog pet in `loop()`.
- Do **not** change relay `HIGH`/`LOW` semantics — the relay board polarity is fixed.
- Keep all blocking reconnect timeouts short (≤ 15 s) so the safety loop is not starved.

---

## Patch 1 — Add includes

**Where:** immediately after the last existing `#include` line at the top of the sketch.

```cpp
// ── Step 1 additions: Wi-Fi + MQTT ───────────────────────────────
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
// #include "secrets.h"   // uncomment when secrets.h exists
```

**Required libraries** (install via Arduino Library Manager if not already present):

| Library | Manager search term |
|---|---|
| PubSubClient | `PubSubClient` by Nick O'Leary |
| ArduinoJson | `ArduinoJson` by Benoît Blanchon |
| WiFi.h | built-in ESP32 core — no install needed |
| time.h | built-in — no install needed |

---

## Patch 2 — Add config block

**Where:** after the existing pin-constant block, before any function definitions.  
Use a `secrets.h` file for Wi-Fi values. Current MQTT host is shown below.

```cpp
// ── Step 1 config ───────────────────────────────────────────────
#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"
#define MQTT_HOST         "smarthome-capstone.duckdns.org"
#define MQTT_PORT         1883
#define DEVICE_ID         "esp32_home_01"
#define FIRMWARE_VERSION  "mch-step1-heartbeat"
#define HEARTBEAT_INTERVAL_MS  30000UL
```

`secrets.h` template:

```cpp
// secrets.h
#define WIFI_SSID         "your_actual_ssid"
#define WIFI_PASSWORD     "your_actual_password"
#define MQTT_HOST         "smarthome-capstone.duckdns.org"
```

---

## Patch 3 — Add global objects

**Where:** after the config block, before `setup()`. Place alongside any existing global sensor objects.

```cpp
// ── Step 1 globals ────────────────────────────────────────────────
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
unsigned long lastHeartbeatMs = 0;
```

---

## Patch 4 — Add helper functions

**Where:** paste all six functions before `setup()`, or in a new `.ino` tab named `mqtt_heartbeat.ino`.  
Do not modify any existing functions.

```cpp
// ── connectWiFi ───────────────────────────────────────────────────
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

// ── syncTime ──────────────────────────────────────────────────────
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

// ── connectMqtt ───────────────────────────────────────────────────
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

// ── ensureMqttConnected ───────────────────────────────────────────
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

// ── isoTimestamp ──────────────────────────────────────────────────
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

// ── publishHeartbeat ──────────────────────────────────────────────
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

  bool ok = mqtt.publish("home/esp32_home_01/heartbeat", payload, false);
  Serial.print("[HEARTBEAT] ");
  Serial.print(ok ? "OK  " : "FAIL  ");
  Serial.println(payload);
}
```

---

## Patch 5 — setup() insertion

**Existing setup() sequence (do not reorder or remove):**

```
delay(...)
Serial.begin(115200)
Wire.begin(SDA, SCL)
SPI.begin(...)
RFID init
pinMode calls
relay setup (initial LOW/HIGH)
servo attach
dht.begin()
hardware checks / Serial diagnostics
watchdog timer setup
```

**Insert the three calls after `Serial.begin(115200)` and before `Wire.begin` / sensor init:**

```cpp
  // ── Step 1: Wi-Fi + MQTT ─────────────────────────────────────
  connectWiFi();
  syncTime();
  connectMqtt();
  // ─────────────────────────────────────────────────────────────
```

Full context (surrounding lines shown for placement, fill in actual values from code-final):

```cpp
  Serial.begin(115200);
  delay(100);                     // existing delay if present — keep it

  // ── Step 1 insertion point ───────────────────────────────────
  connectWiFi();
  syncTime();
  connectMqtt();
  // ─────────────────────────────────────────────────────────────

  Wire.begin(SDA_PIN, SCL_PIN);   // existing — do not remove
  SPI.begin(...);                 // existing — do not remove
  // ... rest of existing setup unchanged ...
```

---

## Patch 6 — loop() insertion

**Existing loop() sequence (do not reorder or remove):**

```
timerWrite(watchdogTimer, 0)   ← watchdog pet — always first
sensor reads
safety interlock checks
actuator control
Serial diagnostics
```

**Insert immediately after the watchdog pet line:**

```cpp
  timerWrite(watchdogTimer, 0);   // existing watchdog pet — keep first

  // ── Step 1: MQTT keep-alive + heartbeat ──────────────────────
  ensureMqttConnected();
  mqtt.loop();
  if (mqtt.connected() && (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS)) {
    lastHeartbeatMs = millis();
    publishHeartbeat();
  }
  // ─────────────────────────────────────────────────────────────

  // ... rest of existing loop unchanged ...
```

**Why immediately after watchdog pet:**  
The MQTT keep-alive and reconnect calls may take up to a few hundred milliseconds on a cold reconnect. Placing them first (after the watchdog pet) ensures the watchdog is satisfied before any potential brief delay. The safety interlock checks run immediately after, unmodified.

---

## Patch 7 — .gitignore entry

Recommended `.gitignore` entries in the firmware sketch directory:

```
secrets.h
*.bin
*.elf
```



---

## Heartbeat payload reference

**Topic:** `home/esp32_home_01/heartbeat`

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

All six fields are required. The backend rejects payloads with missing or unknown fields.

---

## Testing checklist

Upload the modified sketch.

- [ ] Serial monitor: `[WiFi] Connecting to ...` followed by `[WiFi] Connected, IP: ...`
- [ ] Serial monitor: `[NTP] Time synced`
- [ ] Serial monitor: `[MQTT] Connected`
- [ ] Serial monitor: `[HEARTBEAT] OK  {"device_id":"esp32_home_01",...}` appears every ~30 seconds
- [ ] `GET /api/devices` returns `esp32_home_01` with `"status": "online"` (requires backend deployed and running)
- [ ] Android Devices screen (pull-to-refresh) shows `esp32_home_01` **Online**
- [ ] Admin Web Devices panel shows `esp32_home_01` **Online**
- [ ] Power off ESP32, wait 90 s → backend marks `esp32_home_01` **Offline**
- [ ] Power on ESP32 → status returns **Online** within one heartbeat interval (~30 s)
- [ ] All existing sensor Serial output is still present (no regression)
- [ ] Relay/pump behavior unchanged (no spurious activations during boot)

---

## What comes next (Step 2 — do not implement yet)

After this checklist passes:

- Step 2 adds telemetry snapshot publishing to `home/esp32_home_01/telemetry`
- Step 3 adds event publishing (fire, gas, CO, motion, vibration, reed) to `home/esp32_home_01/event`
- Step 4 adds RFID SHA-256 hash and access event publishing
- Step 5 adds override command subscribe and component heartbeats

Full payload schemas for all steps: `firmware/FIRMWARE_CONTRACT.md`

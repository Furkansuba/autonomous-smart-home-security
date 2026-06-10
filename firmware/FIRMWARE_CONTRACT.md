# Firmware Integration Contract — MCH Handoff
## Autonomous Smart Home Security


---

## 1. Current MCH Firmware Status

The current `code-final` sketch is a **standalone, local-only** implementation. It reads sensors and controls outputs without any network connectivity. The following are **not yet implemented** in firmware:

| Missing feature | Required for integration |
|---|---|
| Wi-Fi connection | All MQTT |
| MQTT client | All telemetry, events, heartbeat |
| NTP / UTC timestamp | All payloads |
| JSON serialisation | All payloads |
| Heartbeat publish | Device online detection |
| Telemetry publish | Sensor data in app |
| Event publish | Alerts, FCM push |
| Access log publish | RFID audit trail |
| Override subscribe | Remote actuator control |
| Override result publish | Command acknowledgement |

Nothing in this list changes sensor wiring or pump control logic. It is all additive.

---

## 2. Required Libraries

Add to `platformio.ini` (or Arduino Library Manager):

```ini
; Network
WiFi.h                  ; built-in ESP32 core

; MQTT
knolleary/PubSubClient @ ^2.8
; or: marvinroger/AsyncMqttClient (interrupt-safe, preferred for production)

; JSON
bblanchon/ArduinoJson @ ^7

; Time (NTP)
; Built into ESP32 Arduino core via configTime() / time.h
; No extra library needed.

; UID hashing (optional — SHA-256 for RFID card_uid_hash)
; Use mbedtls/sha256.h — built into ESP32 core, no install needed.
```

---

## 3. MQTT Broker

| Property | Value |
|---|---|
| Host | `smarthome-capstone.duckdns.org` |
| Port | **1883 TCP** |
| TLS | No |
| Auth | None for current demo broker |
| Protocol | MQTT 3.1.1 |
| ESP32 client | `WiFiClient` + `PubSubClient` |
| Client ID | `esp32_home_01` (must be unique per connection) |

Use `WiFiClient`, not `WiFiClientSecure`, for the current demo broker.

---

## 4. MQTT Topic Contract

### Device → Backend (ESP32 publishes)

| Topic | Use |
|---|---|
| `home/{deviceId}/heartbeat` | Liveness ping every 30 s |
| `home/{deviceId}/telemetry` | Sensor snapshot |
| `home/{deviceId}/event` | Detected event (fire, gas, intrusion…) |
| `home/{deviceId}/access` | RFID access attempt result |
| `home/{deviceId}/override/result` | Override command acknowledgement |

### Backend → Device (ESP32 subscribes)

| Topic | Use |
|---|---|
| `home/{deviceId}/cmd/override` | Override command from admin |
| `home/{deviceId}/cmd/arm` | Reserved — arm system |
| `home/{deviceId}/cmd/disarm` | Reserved — disarm system |
| `home/{deviceId}/cmd/reset` | Reserved — system reset |
| `home/{deviceId}/cmd/unlock` | Reserved — door unlock |

For the main controller `{deviceId}` is always `esp32_home_01`.  
Logical component heartbeats use their own `{deviceId}` (see §6).

> **`valve_open` / `valve_close` do not exist.** Hardware uses pumps, not valves. Never publish or subscribe to valve topics.

---

## 5. Main Controller Heartbeat

Topic: `home/esp32_home_01/heartbeat`  
Interval: **every 30 seconds**  
QoS: 0  

Payload (matches `contracts/examples/heartbeat.json`):

```json
{
  "device_id": "esp32_home_01",
  "status": "online",
  "firmware_version": "0.1.0",
  "uptime_seconds": 3600,
  "wifi_rssi": -55,
  "timestamp": "2026-06-01T18:45:00Z"
}
```

Field notes:
- `firmware_version` — match your build version string
- `uptime_seconds` — `millis() / 1000` cast to `unsigned long`
- `wifi_rssi` — `WiFi.RSSI()`, always negative
- `timestamp` — UTC ISO-8601, obtained via NTP (see §5.1)
- `status` — always `"online"` when publishing; backend computes degraded/offline from missed heartbeats

### 5.1 NTP Timestamp

```cpp
#include <time.h>

void syncNTP() {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    struct tm ti;
    while (!getLocalTime(&ti)) delay(500);
}

String utcNow() {
    struct tm ti;
    getLocalTime(&ti);
    char buf[25];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &ti);
    return String(buf);
}
```

---

## 6. Logical Component Heartbeats

One physical ESP32 publishes heartbeats **on behalf of** each logical component below. Each heartbeat uses the component's own `device_id` in both the topic and the payload — the backend tracks them independently.

| device_id | Component | Location |
|---|---|---|
| `esp32_home_01` | Main ESP32 Controller | Prototype Home |
| `pcf8574_01` | I2C Expander / Digital Bus | Prototype Home |
| `flame_sensor_01` | Flame Sensor Group | Multi-room |
| `mq2_sensor_01` | MQ-2 Gas Sensor | Kitchen |
| `mq7_sensor_01` | MQ-7 CO Sensor | Garage |
| `dht_sensor_01` | DHT Climate Sensor | Prototype Home |
| `pir_sensor_01` | PIR Motion Sensor Group | Hallway / Garage / Living Room |
| `impact_sensor_01` | Impact Sensor Group | Garage / Hallway |
| `reed_sensor_01` | Reed Switch Group | Bedroom 1 / Bedroom 2 / Kitchen |
| `door_controller_01` | Door Controller | Main Door |
| `pump_rm1_01` | Bedroom 1 Pump | Bedroom 1 |
| `pump_rm2_01` | Bedroom 2 Pump | Bedroom 2 |
| `pump_kit_01` | Kitchen Pump | Kitchen |
| `pump_liv_01` | Living Room Pump | Living Room |
| `buzzer_01` | Alarm Buzzer | Hallway |

Example — flame sensor heartbeat:

```
Topic:   home/flame_sensor_01/heartbeat
Payload: { "device_id": "flame_sensor_01", "status": "online", ... }
```

**Backend behaviour on missed heartbeat:**
- > 60 s since last heartbeat → component status = `degraded`
- > 90 s since last heartbeat → component status = `offline`

**Not implemented in v1 — do not publish:**
- `sensor_fault` events
- `actuator_fault` events

A physically broken sensor should simply stop sending its heartbeat; the backend will show it as offline.

---

## 7. Telemetry Payload

Topic: `home/esp32_home_01/telemetry`  
Frequency: recommend every 30–60 s, or on significant change  
Payload (matches `contracts/examples/telemetry.json`):

```json
{
  "device_id": "esp32_home_01",
  "room_id": "kitchen",
  "temperature_c": 24.6,
  "humidity_percent": 48.2,
  "gas_raw": 315,
  "co_raw": 120,
  "flame_detected": false,
  "motion_detected": false,
  "reed_open": false,
  "timestamp": "2026-06-01T18:45:05Z"
}
```

### Sensor mapping

| Payload field | MCH source | Notes |
|---|---|---|
| `temperature_c` | DHT `readTemperature()` | Float, Celsius |
| `humidity_percent` | DHT `readHumidity()` | Float |
| `gas_raw` | MQ-2 `analogRead()` | Raw ADC integer |
| `co_raw` | MQ-7 `analogRead()` | Raw ADC integer |
| `flame_detected` | PCF8574 flame bit(s) | `true` if any flame zone active |
| `motion_detected` | PIR digital read | `true` if any PIR high |
| `reed_open` | Reed switch digital read | `true` if any reed open |

### Room ID mapping

Valid `room_id` values: `kitchen`, `living_room`, `bedroom_1`, `bedroom_2`, `garage`, `hallway`, `main_door`.

If a snapshot covers multiple rooms, publish one telemetry message per room, or use the room of the primary sensor for that snapshot.

---

## 8. Event Payload

Topic: `home/esp32_home_01/event`  
Payload (matches `contracts/examples/event_fire_detected.json`):

```json
{
  "event_id": "evt_20260601_0001",
  "device_id": "esp32_home_01",
  "room_id": "kitchen",
  "event_type": "fire_detected",
  "severity": "critical",
  "message": "Fire detected in kitchen.",
  "sensor_id": "flame_kitchen_01",
  "raw_value": 1,
  "confirmed": true,
  "timestamp": "2026-06-01T18:45:10Z"
}
```

### Sensor → event type mapping

| Trigger | `event_type` | `severity` | `room_id` |
|---|---|---|---|
| MQ-2 above hazard threshold | `gas_detected` | `critical` | `kitchen` |
| MQ-7 above hazard threshold | `co_detected` | `critical` | `garage` |
| PCF8574 flame bit — bedroom 1 zone | `fire_detected` | `critical` | `bedroom_1` |
| PCF8574 flame bit — bedroom 2 zone | `fire_detected` | `critical` | `bedroom_2` |
| PCF8574 flame bit — kitchen zone | `fire_detected` | `critical` | `kitchen` |
| PCF8574 flame bit — living room zone | `fire_detected` | `critical` | `living_room` |
| PIR triggers (motion) | `motion_detected` | `warning` | zone room |
| Impact sensor triggers | `vibration_detected` | `warning` | `garage` / `hallway` |
| Reed switch opens | `reed_switch_opened` | `warning` | zone room |
| Confirmed combined breach | `intrusion_detected` | `warning` or `critical` | zone room |

**Only these `event_type` values are accepted by the backend.** Any other string is rejected.

### event_id generation

```cpp
// Simple: millis-based, unique per session
String makeEventId() {
    return "evt_" + String(millis());
}
```

### Cooldown / state-change guard

**Do not publish an event every loop iteration.** Use a state-change + cooldown pattern:

```cpp
bool prevFlameState = false;
unsigned long lastFlameEventMs = 0;
const unsigned long FLAME_COOLDOWN_MS = 10000; // 10 s minimum between events

void checkFlame() {
    bool flame = readFlameSensor();
    unsigned long now = millis();
    if (flame && !prevFlameState && (now - lastFlameEventMs > FLAME_COOLDOWN_MS)) {
        publishFireEvent();
        lastFlameEventMs = now;
    }
    prevFlameState = flame;
}
```

---

## 9. Access Log Payload

Topic: `home/esp32_home_01/access`  
Payload (matches `contracts/examples/access_granted.json`):

```json
{
  "access_id": "acc_20260601_0001",
  "device_id": "esp32_home_01",
  "gate_id": "main_door",
  "user_id": "usr_resident_001",
  "access_method": "nfc",
  "result": "granted",
  "card_uid_hash": "sha256:example_hash_value",
  "timestamp": "2026-06-01T18:45:20Z"
}
```

### Security warnings — RFID

> **CRITICAL: The current `code-final` sketch stores raw RFID UIDs as byte array constants and logs them over Serial. Do not commit raw UIDs to the repository. Do not transmit raw UIDs over MQTT.**

- `card_uid_hash` must be a SHA-256 hash of the raw UID bytes, hex-encoded with a `sha256:` prefix.
- `user_id` can be a placeholder (`"usr_unknown"`) until the backend user-card mapping is implemented.
- `gate_id` is always `"main_door"` for the current prototype.
- `result` is `"granted"` or `"denied"`.

### SHA-256 hashing on ESP32

```cpp
#include "mbedtls/sha256.h"

String hashUid(byte* uid, byte uidLen) {
    unsigned char hash[32];
    mbedtls_sha256(uid, uidLen, hash, 0);
    String hex = "sha256:";
    for (int i = 0; i < 32; i++) {
        if (hash[i] < 0x10) hex += "0";
        hex += String(hash[i], HEX);
    }
    return hex;
}
```

---

## 10. Override Command — Subscribe and Result

### Subscribe

On startup, subscribe to:

```
home/esp32_home_01/cmd/override
```

### Incoming payload (backend → ESP32)

From `contracts/examples/override_request.json`:

```json
{
  "override_id": "ovr_20260601_0001",
  "device_id": "esp32_home_01",
  "requested_by": "usr_admin_001",
  "actuator_id": "buzzer_01",
  "action": "buzzer_off",
  "reason": "Manual silence after verified test alarm.",
  "timestamp": "2026-06-01T18:45:30Z"
}
```

### Supported actions and hardware mapping

| `action` | `actuator_id` | Hardware |
|---|---|---|
| `buzzer_on` | `buzzer_01` | `BUZZER_PIN` HIGH |
| `buzzer_off` | `buzzer_01` | `BUZZER_PIN` LOW |
| `pump_off` | `pump_rm1_01` | `RELAY_RM1` OFF |
| `pump_off` | `pump_rm2_01` | `RELAY_RM2` OFF |
| `pump_off` | `pump_kit_01` | `RELAY_KIT` OFF |
| `pump_off` | `pump_liv_01` | `RELAY_LIV` OFF |

> **`valve_open` / `valve_close` must never be executed — no valves exist in hardware.** If received, publish result `"failed"` with `blocked_reason: "no_valve_hardware"`.

### Gas/CO pump lockout

If gas or CO is currently detected, **never activate any pump** regardless of override command. Publish result `"failed"` with `blocked_reason: "gas_co_lockout"`. This overrides all other logic.

### Result payload (ESP32 → backend)

Topic: `home/esp32_home_01/override/result`  
Payload (matches `contracts/examples/override_result.json`):

```json
{
  "override_id": "ovr_20260601_0001",
  "device_id": "esp32_home_01",
  "actuator_id": "buzzer_01",
  "action": "buzzer_off",
  "result": "executed",
  "blocked_reason": null,
  "timestamp": "2026-06-01T18:45:35Z"
}
```

- `result` is `"executed"` or `"failed"`.
- `blocked_reason` is `null` on success, or a short string on failure (e.g. `"gas_co_lockout"`, `"unknown_action"`).
- Echo back the same `override_id` from the incoming command.

---

## 11. Pin Map — source of truth: code-final.txt

`code-final.txt` is the current firmware source of truth. Older progress report pin references may be outdated. All integration work should use the values below.

### DHT sensor
| Define | Value |
|---|---|
| `DHTTYPE` | `DHT11` |
| `DHTPIN` | GPIO 15 |

### Gas / CO sensors
| Sensor | GPIO |
|---|---|
| MQ-2 (gas) | GPIO 35 |
| MQ-7 (CO) | GPIO 34 |

### Actuators
| Signal | GPIO | MQTT `device_id` |
|---|---|---|
| Buzzer | GPIO 4 | `buzzer_01` |
| Servo | GPIO 13 | — |
| Relay RM1 | GPIO 32 | `pump_rm1_01` |
| Relay RM2 | GPIO 33 | `pump_rm2_01` |
| Relay KIT | GPIO 25 | `pump_kit_01` |
| Relay LIV | GPIO 26 | `pump_liv_01` |

### Security sensors
| Sensor | GPIO |
|---|---|
| PIR — Hallway | GPIO 36 |
| PIR — Garage | GPIO 39 |
| PIR — Living Room | GPIO 17 |
| Impact — Garage | GPIO 27 |
| Impact — Hallway | GPIO 14 |

### I2C / PCF8574 (flame + reed sensors)
| Item | Value |
|---|---|
| PCF8574 I2C address | `0x20` |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| PCF8574 bits 0–3 | Flame sensor zones |
| PCF8574 bits 4–6 | Reed / window sensors |

### RFID (RC522)
| Pin | GPIO |
|---|---|
| SS / SDA | GPIO 5 |
| RST | -1 (not connected) |

> **RFID security:** `code-final.txt` stores raw RFID UIDs as byte array constants and logs them over Serial. Do not commit raw UIDs to the repository. Do not transmit raw UIDs over MQTT. Access log payloads must use `card_uid_hash` (SHA-256, hex-encoded, `sha256:` prefix). See §9 for the hashing implementation.

---

## 12. Minimal Integration Order

Implement and test in this order. Do not skip steps.

| Step | What to implement | Success criterion |
|---|---|---|
| 1 | Wi-Fi + MQTT connect | Serial log shows `Connected to broker` |
| 2 | `esp32_home_01` heartbeat | `/api/devices` shows `esp32_home_01` online |
| 3 | Telemetry snapshot | Android Sensors screen shows live values |
| 4 | `fire_detected` event | Android / web Events list shows entry; FCM arrives on phone |
| 5 | `gas_detected` and `co_detected` events | Same as step 4 |
| 6 | RFID access logs | Access Log screen shows granted/denied entries |
| 7 | Override subscribe + result publish | Admin override from web executes and shows result |
| 8 | Logical component heartbeats | All 14 component device IDs visible in Devices screen |
| 9 | Full scenario test | All items in §13 checklist pass |

---

## 13. Integration Testing Checklist

Run after each step group is implemented.

### Connectivity
- [ ] ESP32 connects to Wi-Fi without dropping
- [ ] MQTT broker connection established and stays up
- [ ] Reconnect logic works after broker restart

### Heartbeat
- [ ] `esp32_home_01` appears as `online` in `/api/devices`
- [ ] Devices screen in Android app shows `online` badge
- [ ] Stop ESP32 — status changes to `degraded` within 60 s, `offline` within 90 s
- [ ] Restart ESP32 — status returns to `online` on next heartbeat

### Telemetry
- [ ] Temperature and humidity values appear in Android Sensors screen
- [ ] Gas raw and CO raw values update on change
- [ ] `flame_detected`, `motion_detected`, `reed_open` toggle correctly

### Events
- [ ] `fire_detected` event appears in Android Events and admin web Events list
- [ ] `gas_detected` event appears
- [ ] `co_detected` event appears
- [ ] FCM push notification received on physical Android phone for each critical event
- [ ] Cooldown prevents duplicate events within configured window

### Access Log
- [ ] Known card: `result = "granted"` appears in Access Log
- [ ] Unknown card: `result = "denied"` appears in Access Log
- [ ] `card_uid_hash` is present; raw UID is absent from all logs and network traffic

### Override
- [ ] Admin sends `buzzer_off` from web — buzzer stops within 2 s
- [ ] Override result visible in web Override Log
- [ ] `pump_off` override works when no gas/CO active
- [ ] `pump_off` override is **blocked** when gas/CO is active (`gas_co_lockout`)

### Logical Component Heartbeats
- [ ] All 14 component device IDs visible in Android Devices screen
- [ ] Stopping a component simulation → that component shows `degraded` / `offline`

---

## 14. Canonical Payload Reference

Always validate against the files in `contracts/examples/`:

| File | Topic | Direction |
|---|---|---|
| `heartbeat.json` | `home/{deviceId}/heartbeat` | ESP32 → backend |
| `telemetry.json` | `home/{deviceId}/telemetry` | ESP32 → backend |
| `event_fire_detected.json` | `home/{deviceId}/event` | ESP32 → backend |
| `access_granted.json` | `home/{deviceId}/access` | ESP32 → backend |
| `override_request.json` | `home/{deviceId}/cmd/override` | backend → ESP32 |
| `override_result.json` | `home/{deviceId}/override/result` | ESP32 → backend |

These files are the authoritative schema. If firmware output does not validate against them, the backend will reject the message.

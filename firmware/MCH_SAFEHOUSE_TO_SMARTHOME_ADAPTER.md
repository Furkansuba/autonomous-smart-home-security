# SafeHouse → SmartHome MQTT Adapter Guide

**Audience:** MCH firmware team  
**Language:** English  
**Related docs:** `firmware/FIRMWARE_CONTRACT.md`, `firmware/ESP32_MQTT_HEARTBEAT_STEP1_PATCH.md`

---

## 1. Purpose

Your SafeHouse MQTT patch is not wasted.

You have already done the hard part: Wi-Fi connect, NTP sync, MQTT reconnect logic, PubSubClient setup, ArduinoJson payload building, secrets.h separation, and publish/subscribe helpers. **Keep all of that.**

The only work remaining is a contract mapping — replacing SafeHouse topic strings, payload field names, and device identifiers with the SmartHome backend equivalents. The tested local safety logic (gas interlock, thermal interlock, relay control, RFID whitelist) does not change at all.

**Do not rewrite your firmware from scratch.** Apply the mapping changes below on top of your existing patched sketch.

---

## 2. Keep unchanged — do not touch these

### Pin map (source of truth: code-final)

| Signal | GPIO |
|---|---|
| DHT11 data | 15 |
| MQ-2 gas | 35 |
| MQ-7 CO | 34 |
| Buzzer | 4 |
| Servo | 13 |
| Relay RM1 → `pump_rm1_01` | 32 |
| Relay RM2 → `pump_rm2_01` | 33 |
| Relay KIT → `pump_kit_01` | 25 |
| Relay LIV → `pump_liv_01` | 26 |
| PIR Hallway | 36 |
| PIR Garage | 39 |
| PIR Living Room | 17 |
| Impact Garage | 27 |
| Impact Hallway | 14 |
| PCF8574 SDA | 21 |
| PCF8574 SCL | 22 |
| PCF8574 bits 0–3 | Flame zones |
| PCF8574 bits 4–6 | Reed / window sensors |
| RC522 SS/SDA | 5 |

### Safety functions — leave untouched

- `executeGasInterlock()` — gas/CO detected → lock all pumps, trigger buzzer
- `executeThermalInterlock()` — fire detected → activate room pump, trigger buzzer
- `checkSecurityBreaches()` — PIR, impact, reed evaluation
- `handleRFIDAccess()` — local whitelist check, door servo/lock control
- `handleSerialConsole()` — serial debug/override commands

### Safety priorities — do not reorder

1. Gas / CO interlock (highest — pump lockout mandatory)
2. Fire / thermal interlock
3. Security breach detection

### Relay semantics — do not change

Keep whatever `HIGH`/`LOW` convention your relay board uses. The SmartHome backend only receives event and heartbeat notifications — it does not infer relay state from them.

### RFID local whitelist — do not change

The local UID whitelist array grants physical access. Keep it exactly as-is. Only the MQTT reporting changes (see §9).

### Gas/CO pump lockout — mandatory, non-negotiable

Never activate any pump relay while gas or CO is active, even if an override command arrives. The lockout check must run before any actuator command from MQTT is applied.

---

## 3. Contract mapping table

| SafeHouse | SmartHome | Notes |
|---|---|---|
| `deviceId` | `device_id` | field rename in JSON |
| `"esp32-house-01"` | `"esp32_home_01"` | device identifier |
| `home/telemetry` (heartbeat msg) | `home/esp32_home_01/heartbeat` | topic change |
| `home/telemetry` + `eventType: "gas"` | `home/esp32_home_01/event` + `"event_type": "gas_detected"` | topic + field rename |
| `home/telemetry` + `eventType: "co"` | `home/esp32_home_01/event` + `"event_type": "co_detected"` | topic + field rename |
| `home/telemetry` + `eventType: "fire"` | `home/esp32_home_01/event` + `"event_type": "fire_detected"` | topic + field rename |
| `home/telemetry` + `eventType: "intrusion"` | `home/esp32_home_01/event` + `"event_type": "intrusion_detected"` | topic + field rename |
| `home/telemetry` + `eventType: "climate"` | `home/esp32_home_01/telemetry` | separate topic for sensor snapshots |
| `home/access` + `nfcUid` | `home/esp32_home_01/access` + `card_uid_hash` | UID must be hashed — see §9 |
| `home/actuators/esp32-house-01/+` | `home/esp32_home_01/cmd/override` | subscribe topic for override commands |
| `home/actuators/.../ack` | `home/esp32_home_01/override/result` | publish topic for override acknowledgement |

---

## 4. Broker note

- Use the SmartHome MQTT broker host and port provided by the software team. Do not hardcode the host or port in any file that will be committed.
- The broker currently uses **port 1883** (plain TCP). Use `WiFiClient` (not `WiFiClientSecure`) for this.
- If TLS on port 8883 is enabled later, switch to `WiFiClientSecure` with the CA certificate and ensure NTP time is synced before the TLS handshake.
- All broker credentials go in `secrets.h`, which must be listed in `.gitignore` and never committed.

```cpp
// secrets.h — never commit this file
#define WIFI_SSID    "your_ssid"
#define WIFI_PASSWORD "your_password"
#define MQTT_HOST    "ask_software_team"
#define MQTT_PORT    1883
```

---

## 5. SmartHome topic constants

Replace all SafeHouse topic strings with these. Define them as constants to avoid typos:

```cpp
#define TOPIC_HEARTBEAT       "home/esp32_home_01/heartbeat"
#define TOPIC_TELEMETRY       "home/esp32_home_01/telemetry"
#define TOPIC_EVENT           "home/esp32_home_01/event"
#define TOPIC_ACCESS          "home/esp32_home_01/access"
#define TOPIC_OVERRIDE_CMD    "home/esp32_home_01/cmd/override"
#define TOPIC_OVERRIDE_RESULT "home/esp32_home_01/override/result"
```

Subscribe to `TOPIC_OVERRIDE_CMD` in your MQTT connect callback so override commands are received after reconnect.

---

## 6. Room ID mapping

Replace SafeHouse room strings with SmartHome `room_id` values in all event and telemetry payloads:

| SafeHouse | SmartHome `room_id` |
|---|---|
| `"room1"` | `"bedroom_1"` |
| `"room2"` | `"bedroom_2"` |
| `"livingroom"` | `"living_room"` |
| `"frontdoor"` | `"main_door"` |
| `"kitchen"` | `"kitchen"` |
| `"garage"` | `"garage"` |
| `"hallway"` | `"hallway"` |

---

## 7. Payload examples

All payloads are published as JSON strings. Use ArduinoJson's `serializeJson(doc, buffer)` to build them.

### 7a. Heartbeat

**Topic:** `home/esp32_home_01/heartbeat`

```json
{
  "device_id":        "esp32_home_01",
  "status":           "online",
  "firmware_version": "mch-integrated-v1",
  "uptime_seconds":   3600,
  "wifi_rssi":        -52,
  "timestamp":        "2026-06-07T10:00:00Z"
}
```

Publish every 30 seconds. All six fields are required.

### 7b. Gas detected

**Topic:** `home/esp32_home_01/event`

```json
{
  "device_id":  "esp32_home_01",
  "event_type": "gas_detected",
  "severity":   "critical",
  "room_id":    "kitchen",
  "value":      1450,
  "unit":       "ppm",
  "timestamp":  "2026-06-07T10:01:00Z"
}
```

### 7c. CO detected

**Topic:** `home/esp32_home_01/event`

```json
{
  "device_id":  "esp32_home_01",
  "event_type": "co_detected",
  "severity":   "critical",
  "room_id":    "garage",
  "value":      380,
  "unit":       "ppm",
  "timestamp":  "2026-06-07T10:01:30Z"
}
```

### 7d. Fire detected

**Topic:** `home/esp32_home_01/event`

```json
{
  "device_id":  "esp32_home_01",
  "event_type": "fire_detected",
  "severity":   "critical",
  "room_id":    "bedroom_1",
  "timestamp":  "2026-06-07T10:02:00Z"
}
```

### 7e. Intrusion detected

**Topic:** `home/esp32_home_01/event`

```json
{
  "device_id":  "esp32_home_01",
  "event_type": "intrusion_detected",
  "severity":   "warning",
  "room_id":    "hallway",
  "timestamp":  "2026-06-07T10:03:00Z"
}
```

### 7f. Climate telemetry snapshot

**Topic:** `home/esp32_home_01/telemetry`

```json
{
  "device_id":   "esp32_home_01",
  "temperature": 24.5,
  "humidity":    58.0,
  "gas_raw":     320,
  "co_raw":      110,
  "timestamp":   "2026-06-07T10:00:00Z"
}
```

### 7g. Access log

**Topic:** `home/esp32_home_01/access`

```json
{
  "device_id":     "esp32_home_01",
  "card_uid_hash": "sha256:3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b",
  "access_granted": true,
  "timestamp":     "2026-06-07T10:05:00Z"
}
```

`card_uid_hash` must always be `"sha256:<hex-digest>"`. Never publish raw UID bytes.

### 7h. Override command (received from backend)

**Topic subscribed:** `home/esp32_home_01/cmd/override`

```json
{
  "command":    "pump_off",
  "device_id":  "esp32_home_01",
  "issued_by":  "admin",
  "timestamp":  "2026-06-07T10:06:00Z"
}
```

### 7i. Override result (published by ESP32)

**Topic:** `home/esp32_home_01/override/result`

```json
{
  "device_id":  "esp32_home_01",
  "command":    "pump_off",
  "status":     "executed",
  "timestamp":  "2026-06-07T10:06:01Z"
}
```

Use `"status": "rejected"` with an optional `"reason"` field if gas/CO lockout prevented execution.

---

## 8. Override command mapping

| SafeHouse command | SmartHome `command` | What to do on ESP32 |
|---|---|---|
| `"sprinklers_on"` | `"pump_on"` | Activate relay for the specified room (only if no gas/CO active) |
| `"sprinklers_off"` | `"pump_off"` | Set all 4 pump relays HIGH (off) |
| `"alarm_on"` | `"buzzer_on"` | Activate buzzer GPIO4 |
| `"alarm_off"` | `"buzzer_off"` | Deactivate buzzer GPIO4 |
| `"door_lock"` | `"door_lock"` | Lock door servo/relay if supported |
| `"door_unlock"` | `"door_unlock"` | Unlock door servo/relay if supported |

**Important notes:**

- `pump_off` means all 4 relay pins set to their OFF state (HIGH or LOW depending on board polarity — do not change relay semantics).
- There are **no valves**. `valve_01`, `valve_open`, and `valve_close` do not exist in this system. Never publish or subscribe to valve topics.
- Gas/CO lockout is mandatory: if gas or CO is currently active, reject any `pump_on` command and publish `"status": "rejected", "reason": "gas_co_lockout"` on the override result topic.

---

## 9. RFID security

**Do not publish the raw RFID UID over MQTT. Do not commit raw UIDs to the repository.**

Hash the UID with SHA-256 before publishing:

```cpp
#include "mbedtls/sha256.h"

String hashUid(byte *uid, byte uidSize) {
  uint8_t hash[32];
  mbedtls_sha256(uid, uidSize, hash, 0);  // 0 = SHA-256, not SHA-224
  String result = "sha256:";
  for (int i = 0; i < 32; i++) {
    if (hash[i] < 16) result += "0";
    result += String(hash[i], HEX);
  }
  return result;
}
```

`mbedtls/sha256.h` is built into the ESP32 Arduino core — no extra library install needed.

Use the result as the `card_uid_hash` field value in the access payload.

If hashing on the ESP32 is not feasible in your current sprint, **contact the software team before sending anything**. Raw UIDs are not accepted on any MQTT topic.

---

## 10. AI prompt for conversion

If you want to use Gemini, Claude, or another AI assistant to help convert your SafeHouse MQTT sketch to the SmartHome contract, copy and paste the prompt below. Attach or paste your patched sketch when asked.

---

```
I have an ESP32 Arduino sketch that has already been patched to use 
Wi-Fi, NTP, MQTT (PubSubClient), ArduinoJson, and a secrets.h file. 
The local sensor and safety logic is from our "SafeHouse" project.

Please convert the MQTT contract mapping only, following these rules:

1. Do NOT change any pin numbers.
2. Do NOT change any relay HIGH/LOW semantics.
3. Do NOT change sensor read logic (DHT, MQ-2, MQ-7, flame, PIR, 
   impact, reed).
4. Do NOT change safety interlock logic (gas lockout, fire interlock, 
   security breach detection).
5. Do NOT change RFID local whitelist behavior.
6. Do NOT change threshold values for gas, CO, temperature, or motion.
7. Do NOT change watchdog timer logic.
8. Keep Wi-Fi, NTP, MQTT reconnect, PubSubClient, ArduinoJson, and 
   secrets.h as-is.

Only update the MQTT contract:
- Replace device identifier "esp32-house-01" with "esp32_home_01".
- Replace topic "home/telemetry" heartbeat messages with topic 
  "home/esp32_home_01/heartbeat" and payload field "device_id".
- Replace SafeHouse event messages with topic 
  "home/esp32_home_01/event" and payload fields: device_id, 
  event_type, severity, room_id, timestamp.
- event_type values: gas_detected / co_detected / fire_detected / 
  intrusion_detected / motion_detected / vibration_detected / 
  reed_switch_opened.
- Replace climate telemetry with topic "home/esp32_home_01/telemetry".
- Replace access topic with "home/esp32_home_01/access" using 
  card_uid_hash (SHA-256 hex, prefixed "sha256:") — never raw UID.
- Replace override subscribe topic with 
  "home/esp32_home_01/cmd/override".
- Replace override ack topic with 
  "home/esp32_home_01/override/result".
- Replace room strings: room1→bedroom_1, room2→bedroom_2, 
  livingroom→living_room, frontdoor→main_door.
- Remove all SafeHouse identifiers: esp32-house-01, home/telemetry, 
  eventType, deviceId, nfcUid, home/actuators.
- No valves: valve_01, valve_open, valve_close must not appear.
- Gas/CO lockout: pump commands must be rejected if gas or CO is active.

Do not include real Wi-Fi credentials, MQTT host, or raw RFID UIDs 
in the output. Use placeholder comments for those values.
```

---

## 11. Validation checklist

After conversion, search your sketch for old and new strings to confirm the mapping is complete.

### Old SafeHouse strings — must NOT appear in active code

```
grep -r "esp32-house-01"  src/
grep -r "home/telemetry"  src/
grep -r "eventType"       src/
grep -r "deviceId"        src/
grep -r "nfcUid"          src/
grep -r "home/actuators"  src/
grep -rE '"room1"|"room2"' src/
grep -r '"livingroom"'    src/
```

All of the above should return **no matches** in active `.ino` / `.cpp` / `.h` files (comment references are acceptable).

### New SmartHome strings — must exist

```
grep -r "esp32_home_01"                   src/
grep -r "device_id"                       src/
grep -r "event_type"                      src/
grep -r "room_id"                         src/
grep -r "card_uid_hash"                   src/
grep -r "home/esp32_home_01/heartbeat"    src/
grep -r "home/esp32_home_01/event"        src/
grep -r "home/esp32_home_01/telemetry"    src/
grep -r "home/esp32_home_01/access"       src/
grep -r "home/esp32_home_01/cmd/override" src/
grep -r "home/esp32_home_01/override/result" src/
```

All of the above should return **at least one match**.

### Safety invariants — must still exist

```
grep -r "executeGasInterlock\|gas.*lock\|GAS.*LOCK"  src/
grep -r "pump_off\|relayOff\|ALL.*HIGH\|HIGH.*relay"  src/
grep -r "sha256\|mbedtls\|hashUid\|card_uid_hash"     src/
```

---

*For full payload schemas and topic list, see `firmware/FIRMWARE_CONTRACT.md`.*  
*For integration step order, see `firmware/MCH_QUICK_HANDOFF.md`.*

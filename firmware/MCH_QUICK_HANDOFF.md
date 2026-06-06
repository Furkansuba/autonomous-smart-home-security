# MCH Quick Handoff — ESP32 Integration
**Full contract:** `firmware/FIRMWARE_CONTRACT.md`

---

## 1. Current problem

The existing `code-final` sketch is **standalone**. It reads sensors and drives outputs locally.  
It has **no Wi-Fi, no MQTT, no JSON, no NTP**. Serial logs never reach the backend or the app.

---

## 2. Minimum integration — three steps

| Step | What | Done when |
|---|---|---|
| 1 | Wi-Fi + MQTT connect, publish `esp32_home_01` heartbeat every 30 s | `/api/devices` shows `esp32_home_01` **online** |
| 2 | Publish one telemetry snapshot | Android Sensors screen shows live values |
| 3 | Publish one `fire_detected` event | Alert appears in app; FCM push arrives on phone |

Everything else (RFID, override subscribe, component heartbeats) builds on top of these three.

---

## 3. MQTT broker

- **Host:** EC2 public IP — ask software team, do not hardcode in source
- **Port:** 1883 TCP, no auth
- **Rule:** put host, SSID, and password in a `secrets.h` that is `.gitignore`d — never commit them

---

## 4. First heartbeat

**Topic:** `home/esp32_home_01/heartbeat`  
**Interval:** every 30 seconds  

```json
{
  "device_id":        "esp32_home_01",
  "status":           "online",
  "firmware_version": "0.1.0",
  "uptime_seconds":   3600,
  "wifi_rssi":        -55,
  "timestamp":        "2026-06-07T10:00:00Z"
}
```

- `uptime_seconds` → `millis() / 1000`  
- `wifi_rssi` → `WiFi.RSSI()`  
- `timestamp` → UTC from NTP (`configTime(0, 0, "pool.ntp.org")`)  
- Backend marks the device **degraded** after 60 s silence, **offline** after 90 s.

---

## 5. Logical component heartbeat IDs

One ESP32 publishes heartbeats on behalf of each component. Use the exact `device_id` below in both the MQTT topic and the payload.

```
home/esp32_home_01/heartbeat       home/pcf8574_01/heartbeat
home/flame_sensor_01/heartbeat     home/mq2_sensor_01/heartbeat
home/mq7_sensor_01/heartbeat       home/dht_sensor_01/heartbeat
home/pir_sensor_01/heartbeat       home/impact_sensor_01/heartbeat
home/reed_sensor_01/heartbeat      home/door_controller_01/heartbeat
home/pump_rm1_01/heartbeat         home/pump_rm2_01/heartbeat
home/pump_kit_01/heartbeat         home/pump_liv_01/heartbeat
home/buzzer_01/heartbeat
```

Approved `device_id` values (15 total):

| device_id | Component |
|---|---|
| `esp32_home_01` | Main ESP32 Controller |
| `pcf8574_01` | I2C Expander |
| `flame_sensor_01` | Flame Sensor Group |
| `mq2_sensor_01` | MQ-2 Gas Sensor |
| `mq7_sensor_01` | MQ-7 CO Sensor |
| `dht_sensor_01` | DHT Climate Sensor |
| `pir_sensor_01` | PIR Motion Sensor Group |
| `impact_sensor_01` | Impact Sensor Group |
| `reed_sensor_01` | Reed Switch Group |
| `door_controller_01` | Door Controller |
| `pump_rm1_01` | Bedroom 1 Pump |
| `pump_rm2_01` | Bedroom 2 Pump |
| `pump_kit_01` | Kitchen Pump |
| `pump_liv_01` | Living Room Pump |
| `buzzer_01` | Alarm Buzzer |

---

## 6. Sensor → event mapping

Publish to `home/esp32_home_01/event`. Use **only** these `event_type` values — anything else is rejected.

| Sensor trigger | `event_type` | `severity` | `room_id` |
|---|---|---|---|
| MQ-2 above threshold | `gas_detected` | `critical` | `kitchen` |
| MQ-7 above threshold | `co_detected` | `critical` | `garage` |
| Flame zone — bedroom 1 | `fire_detected` | `critical` | `bedroom_1` |
| Flame zone — bedroom 2 | `fire_detected` | `critical` | `bedroom_2` |
| Flame zone — kitchen | `fire_detected` | `critical` | `kitchen` |
| Flame zone — living room | `fire_detected` | `critical` | `living_room` |
| PIR motion | `motion_detected` | `warning` | zone room |
| Impact sensor | `vibration_detected` | `warning` | `garage` / `hallway` |
| Reed switch open | `reed_switch_opened` | `warning` | zone room |
| Combined breach | `intrusion_detected` | `warning` | zone room |

**Use a state-change + cooldown guard** — do not publish an event every loop tick.

---

## 7. Pin map — source of truth: code-final.txt

`code-final.txt` is the current firmware source of truth. Older progress report pin references may be outdated.

| Group | Signal | GPIO | Notes |
|---|---|---|---|
| DHT | Data | 15 | Type: `DHT11` |
| Gas | MQ-2 | 35 | Analog ADC |
| Gas | MQ-7 | 34 | Analog ADC |
| Actuator | Buzzer | 4 | |
| Actuator | Servo | 13 | |
| Actuator | Relay RM1 → `pump_rm1_01` | 32 | |
| Actuator | Relay RM2 → `pump_rm2_01` | 33 | |
| Actuator | Relay KIT → `pump_kit_01` | 25 | |
| Actuator | Relay LIV → `pump_liv_01` | 26 | |
| Security | PIR Hallway | 36 | |
| Security | PIR Garage | 39 | |
| Security | PIR Living Room | 17 | |
| Security | Impact Garage | 27 | |
| Security | Impact Hallway | 14 | |
| I2C | SDA | 21 | PCF8574 @ `0x20` |
| I2C | SCL | 22 | |
| I2C | PCF8574 bits 0–3 | — | Flame sensor zones |
| I2C | PCF8574 bits 4–6 | — | Reed / window sensors |
| RFID | RC522 SS/SDA | 5 | |
| RFID | RC522 RST | -1 | Not connected |

---

## 8. Safety rules — non-negotiable

- **Gas / CO detected → pump lockout.** Never activate any pump while gas or CO is active, even via override command.
- **No valves.** The hardware has 4 pumps (`pump_rm1_01`→`pump_rm2_01`→`pump_kit_01`→`pump_liv_01`). `valve_open` / `valve_close` do not exist — never publish them.
- **Raw RFID UIDs must not be committed or transmitted.** Hash with SHA-256 (`mbedtls/sha256.h`, built into ESP32 core) and send `card_uid_hash` only.

---

## 9. First live integration test sequence

```
1. Flash firmware with Wi-Fi + MQTT + heartbeat only.
2. Open GET /api/devices (or Android Devices screen).
3. Confirm esp32_home_01 status = online.
4. Wait 90 s with ESP32 off → confirm status = offline.
5. Restart ESP32 → confirm status = online within 30 s.
6. Publish one telemetry payload → confirm values in Android Sensors screen.
7. Publish fire_detected event → confirm entry in Android Events + FCM push on phone.
```

---

*For full payload schemas, topic list, NTP code, SHA-256 hashing, override subscribe/result, and pin mapping — see `firmware/FIRMWARE_CONTRACT.md`.*

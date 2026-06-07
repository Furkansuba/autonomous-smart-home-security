# esp32_heartbeat_step1 — Standalone Heartbeat Test Sketch

## Purpose

Verify that the ESP32 can:

1. Connect to Wi-Fi
2. Sync UTC time via NTP
3. Connect to the MQTT broker
4. Publish a valid `esp32_home_01` heartbeat payload every 30 seconds

This sketch exercises **nothing else**. It has no sensor, relay, pump, servo, RFID, or safety logic. Use it to confirm network connectivity and backend heartbeat reception before modifying `code-final`.

---

## Required Arduino libraries

Install via **Arduino Library Manager** (Sketch → Include Library → Manage Libraries):

| Library | Author | Version |
|---|---|---|
| PubSubClient | Nick O'Leary | ≥ 2.8 |
| ArduinoJson | Benoît Blanchon | ≥ 6.x |
| WiFi.h | Built-in ESP32 core | — |
| time.h | Built-in | — |

---

## Placeholders to fill locally

**Do not edit the `.ino` file directly with real credentials.**  
Create a `secrets.h` file in the same folder, add it to `.gitignore`, and uncomment the `#include "secrets.h"` line in the sketch.

```cpp
// secrets.h — add this file to .gitignore, never commit it
#define WIFI_SSID         "your_actual_ssid"
#define WIFI_PASSWORD     "your_actual_password"
#define MQTT_HOST         "ask_software_team_for_host_or_ip"
```

The remaining constants in the sketch can stay as-is for this test:

| Constant | Value | Change? |
|---|---|---|
| `MQTT_PORT` | `1883` | No |
| `DEVICE_ID` | `"esp32_home_01"` | No |
| `FIRMWARE_VERSION` | `"heartbeat-step1-test"` | No |
| `HEARTBEAT_INTERVAL_MS` | `30000` | No |

---

## Expected Serial output

Open Serial Monitor at **115200 baud**. Expected sequence on boot:

```
=== ESP32 Heartbeat Step 1 Test ===
[WiFi] Connecting to your_ssid
......
[WiFi] Connected. IP: 192.168.x.x  RSSI: -52 dBm
[NTP] Syncing time.....
[NTP] Time synced
[MQTT] Connecting to <host>:1883
[MQTT] Connected
[SETUP] Init complete — entering loop
[HEARTBEAT] OK    {"device_id":"esp32_home_01","status":"online","firmware_version":"heartbeat-step1-test","uptime_seconds":5,"wifi_rssi":-52,"timestamp":"2026-06-07T10:00:05Z"}
```

Then every 30 seconds:

```
[HEARTBEAT] OK    {"device_id":"esp32_home_01",...,"uptime_seconds":35,...}
```

If Wi-Fi or MQTT fails:

```
[WiFi] Timeout — could not connect
[MQTT] Failed, state=-2
```

State codes: `-2` = connection refused / host unreachable, `-4` = connection timeout.

---

## Expected backend result

After the backend is deployed and running:

- `GET /api/devices` → `esp32_home_01` appears with `"status": "online"`
- Android Devices screen (pull-to-refresh) → `esp32_home_01` shows **Online**
- Admin Web Devices panel → `esp32_home_01` shows **Online**

The backend marks the device **degraded** after 60 s of silence and **offline** after 90 s.  
Restarting the ESP32 returns it to **Online** within one heartbeat interval (~30 s).

---

## What this sketch does NOT test

- DHT / MQ-2 / MQ-7 / flame / PIR / impact / reed sensor reads
- Relay or pump activation
- RFID card reads or SHA-256 hashing
- Event publishing (`fire_detected`, `gas_detected`, etc.)
- Telemetry publishing
- Override command subscribe
- Component heartbeats (14 logical device IDs)

Those are covered in later steps. See `firmware/FIRMWARE_CONTRACT.md` for the full integration plan.

---

## Safety notes

- Raw RFID UIDs must never be committed or transmitted over MQTT.
- This sketch must not be used as replacement safety firmware — it has no watchdog, no gas lockout, no fire interlock.
- Keep `secrets.h` out of version control at all times.

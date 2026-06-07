# MCH WhatsApp Handoff — SmartHome Firmware Integration

---

## 1. Short WhatsApp Message

Copy and send this as your first message to the MCH group:

---

> Guys, sorry for the late update. Could you please apply these MQTT contract changes to your current patched sketch?
>
> Your current MQTT work is not wasted. Please keep the Wi-Fi / MQTT / NTP / reconnect / helper logic. We only need to convert the topic and payload mapping to our SmartHome backend.
>
> I prepared the required docs and copy-paste prompts below to make it faster. Please do not share real Wi-Fi passwords, MQTT credentials, or raw RFID UIDs in chat.

---

## 2. MQTT Connection Details for Current Demo

Send these connection details alongside the docs:

---

**SmartHome demo MQTT broker:**

| Setting | Value |
|---|---|
| Host | `smarthome-capstone.duckdns.org` |
| Port | `1883` |
| TLS | **No** |
| Username / password | **Not required** |
| ESP32 client class | `WiFiClient` + `PubSubClient` |

**Do not use `WiFiClientSecure` for the current demo broker — there is no TLS.**  
**No CA certificate is required.**  
**Keep Wi-Fi credentials only in a local `secrets.h` file — never paste them into WhatsApp or AI chat.**  
**Do not hardcode real credentials in any sketch that will be shared.**

Example connection code:

```cpp
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

mqtt.setServer("smarthome-capstone.duckdns.org", 1883);
mqtt.connect("esp32_home_01");
```

> **Note:** TLS on port 8883 and MQTT username/password can be added later as post-demo hardening. Do not add them now — it creates avoidable risk close to the demo with no benefit to the current evaluation.

---

## 3. Files to Send to MCH

Send these files from the `firmware/` folder. Priority order:

### Required — send these first

| # | File | Purpose |
|---|---|---|
| 1 | `firmware/MCH_SAFEHOUSE_TO_SMARTHOME_ADAPTER.md` | **Main conversion guide.** Topic/payload mapping from SafeHouse-style MQTT patch to SmartHome contract. Includes room mapping, override mapping, RFID hash rule, validation checklist, and AI prompt. |
| 2 | `firmware/MCH_QUICK_HANDOFF.md` | Quick overview, final pin map (source of truth), first integration target. |
| 3 | `firmware/FIRMWARE_CONTRACT.md` | Full SmartHome MQTT/backend contract reference — all topics, payloads, device IDs, safety rules. |

### Only if they are starting from original code-final (no MQTT patch yet)

| # | File | Purpose |
|---|---|---|
| 4 | `firmware/ESP32_MQTT_HEARTBEAT_STEP1_PATCH.md` | Step-by-step instructions for adding Wi-Fi / MQTT / NTP / heartbeat to code-final safely without touching safety logic. |

### Optional — standalone test sketch

| # | File | Purpose |
|---|---|---|
| 5 | `firmware/examples/esp32_heartbeat_step1/README.md` | Test sketch instructions and expected Serial output. |
| 6 | `firmware/examples/esp32_heartbeat_step1/esp32_heartbeat_step1.ino` | Standalone heartbeat-only test sketch — useful for testing Wi-Fi + MQTT independently before modifying code-final. |

### Do NOT send

- Real `secrets.h` with actual Wi-Fi or MQTT credentials
- Any file containing raw RFID UID values
- Wi-Fi passwords or MQTT passwords in any form
- Send `secrets.h.example` only if a placeholder template is needed

---

## 4. Prompt 1 — Convert an Already MQTT-Patched Sketch

**Use this prompt if the MCH team already has a sketch with Wi-Fi / MQTT / PubSubClient working (SafeHouse-style).**

**Attach these files to the AI chat before sending the prompt:**

- Their current MQTT-patched `.ino` sketch
- `firmware/MCH_SAFEHOUSE_TO_SMARTHOME_ADAPTER.md`
- `firmware/MCH_QUICK_HANDOFF.md`

---

**Copy-paste prompt:**

```
You are given an ESP32 Arduino sketch that is already patched with 
Wi-Fi, MQTT, NTP, and reconnect logic. It currently follows a 
SafeHouse-style MQTT contract.

Convert ONLY the MQTT contract mapping to the SmartHome backend contract.

Rules — do NOT change any of the following:
- Local sensor read logic (DHT, MQ-2, MQ-7, flame, PIR, impact, reed)
- Pin numbers or pin map
- Relay HIGH/LOW semantics
- Gas > Fire > Security priority
- Gas/CO pump lockout behavior
- RFID local whitelist behavior
- Watchdog timer logic
- Debounce and threshold values
- Existing Wi-Fi/MQTT/NTP/reconnect/secrets.h helper style if it works

Current SmartHome demo MQTT broker:
- host: smarthome-capstone.duckdns.org
- port: 1883
- TLS: no
- MQTT username/password: not required
- use WiFiClient (not WiFiClientSecure)

Apply these topic and payload mapping changes:

Identifier rename:
- deviceId         -> device_id
- "esp32-house-01" -> "esp32_home_01"

Topic mapping:
- home/telemetry (heartbeat message)      -> home/esp32_home_01/heartbeat
- home/telemetry + eventType gas          -> home/esp32_home_01/event
- home/telemetry + eventType co           -> home/esp32_home_01/event
- home/telemetry + eventType fire         -> home/esp32_home_01/event
- home/telemetry + eventType intrusion    -> home/esp32_home_01/event
- home/telemetry + eventType climate      -> home/esp32_home_01/telemetry
- home/access (NFC)                       -> home/esp32_home_01/access
- home/actuators/esp32-house-01/+         -> subscribe to home/esp32_home_01/cmd/override
- actuator ack / result                   -> home/esp32_home_01/override/result

Payload field rename:
- eventType   -> event_type
- nfcUid      -> card_uid_hash (must be SHA-256 hash, not raw UID)

event_type values:
- gas       -> gas_detected
- co        -> co_detected
- fire      -> fire_detected
- intrusion -> intrusion_detected

Room ID mapping:
- "room1"       -> "bedroom_1"
- "room2"       -> "bedroom_2"
- "livingroom"  -> "living_room"
- "frontdoor"   -> "main_door"
- "kitchen"     -> "kitchen"
- "garage"      -> "garage"
- "hallway"     -> "hallway"

RFID security rule:
- Do NOT publish raw RFID UIDs over MQTT.
- Do NOT include raw UID values in the output sketch.
- Use card_uid_hash (SHA-256 hex, prefix "sha256:") in access payloads.
- If SHA-256 hashing is not yet implemented, add a placeholder comment 
  and leave the access publish as a TODO — do not send raw UIDs.

Valve rule:
- There are no valves in this system.
- Do not use valve_open, valve_close, or valve_01.
- There are 4 pumps: pump_rm1_01 (relay GPIO32), pump_rm2_01 (GPIO33),
  pump_kit_01 (GPIO25), pump_liv_01 (GPIO26).

Output requirements:
- Output the full updated sketch, not a diff only.
- If the sketch is too long to fit in one response, output it in 
  clearly numbered parts (Part 1 of N, Part 2 of N, etc.).
- Do not include real Wi-Fi passwords.
- Do not include real MQTT credentials.
- Do not include raw RFID UID values.
```

---

## 5. Prompt 2 — Add Step 1 to Original code-final (No MQTT Patch Yet)

**Use this prompt if the MCH team only has the original code-final sketch with no Wi-Fi or MQTT code at all.**

**Attach these files to the AI chat before sending the prompt:**

- Original `code-final.ino` sketch (remove the raw RFID UID constants before attaching — replace with placeholder comments)
- `firmware/ESP32_MQTT_HEARTBEAT_STEP1_PATCH.md`
- `firmware/MCH_QUICK_HANDOFF.md`
- `firmware/FIRMWARE_CONTRACT.md`

---

**Copy-paste prompt:**

```
You are given an original ESP32 Arduino sketch (code-final) that has 
no Wi-Fi, no MQTT, no NTP, and no JSON code. It reads sensors and 
controls actuators locally.

Add Step 1 only: Wi-Fi connection, MQTT connection, NTP time sync, 
and heartbeat publish every 30 seconds for device esp32_home_01.

Target MQTT broker:
- host: smarthome-capstone.duckdns.org
- port: 1883
- TLS: no
- MQTT username/password: not required
- use WiFiClient + PubSubClient (not WiFiClientSecure)

Required libraries (Arduino Library Manager):
- PubSubClient by Nick O'Leary
- ArduinoJson by Benoit Blanchon
- WiFi.h (built-in ESP32 core)
- time.h (built-in)

Heartbeat topic:    home/esp32_home_01/heartbeat
Heartbeat interval: every 30 seconds
Heartbeat payload:
{
  "device_id":        "esp32_home_01",
  "status":           "online",
  "firmware_version": "mch-step1-heartbeat",
  "uptime_seconds":   <millis()/1000>,
  "wifi_rssi":        <WiFi.RSSI()>,
  "timestamp":        "<ISO-8601 UTC from NTP>"
}

Placement rules:
- Add connectWiFi(), syncTime(), connectMqtt() in setup() after 
  Serial.begin() and before sensor/hardware initialization.
- Add ensureMqttConnected(), mqtt.loop(), and the 30-second 
  heartbeat check at the top of loop() immediately after the 
  watchdog pet (timerWrite).
- Do not block the main safety loop for long periods.
- Keep any reconnect timeout short (15 seconds max for Wi-Fi).

Do NOT add in this step:
- Telemetry publish
- Fire, gas, CO, or intrusion event publish
- Access log publish
- Override subscribe or result publish
- Component heartbeats for other device IDs

Do NOT change:
- Any sensor read logic
- Any relay or pump control logic
- RFID local whitelist behavior
- Watchdog timer (keep timerWrite calls in place)
- Local safety logic (gas interlock, fire interlock, security checks)
- Gas > Fire > Security priority
- Relay HIGH/LOW semantics

Credentials:
- Put Wi-Fi SSID, Wi-Fi password, and MQTT host in a secrets.h file.
- Add #include "secrets.h" at the top of the sketch.
- Use placeholder values in the output — do not include real credentials.

Output requirements:
- Output the full updated sketch, or numbered parts if too long.
- Do not include real Wi-Fi passwords, MQTT credentials, or raw RFID 
  UID values in the output.
- If the sketch contains raw UID byte arrays, replace them with 
  a comment saying "// raw UIDs removed for sharing — add back 
  locally from your private copy".
```

---

## 6. Prompt 3 — Self-Audit the Converted Sketch

**Use this prompt after the AI assistant produces the converted sketch, before flashing.**

**Attach these files to the AI chat before sending the prompt:**

- Converted sketch produced by the AI assistant (all parts if split)
- `firmware/MCH_SAFEHOUSE_TO_SMARTHOME_ADAPTER.md`

---

**Copy-paste prompt:**

```
Audit the attached converted ESP32 sketch against the SmartHome 
MQTT contract in the attached adapter guide.

Check 1 — Old SafeHouse identifiers must be REMOVED from active code
(comments are acceptable, active strings and field names are not):

- "esp32-house-01"
- "home/telemetry"
- eventType (as a JSON field name or string)
- deviceId (as a JSON field name)
- nfcUid (as a JSON field name)
- "home/actuators"
- "room1", "room2"
- "livingroom"

Check 2 — New SmartHome identifiers must EXIST:

- "esp32_home_01"
- "device_id" (JSON field)
- "event_type" (JSON field)
- "room_id" (JSON field)
- "card_uid_hash" (JSON field for access payloads)
- "home/esp32_home_01/heartbeat"
- "home/esp32_home_01/event"
- "home/esp32_home_01/telemetry"
- "home/esp32_home_01/access"
- "home/esp32_home_01/cmd/override"
- "home/esp32_home_01/override/result"

Check 3 — Safety invariants must be preserved:

- No raw RFID UID bytes or hex strings are published over MQTT
- No real Wi-Fi password or MQTT credential is hardcoded
- Gas/CO pump lockout logic is still present
- Relay HIGH/LOW semantics are unchanged from the original
- Local safety logic (gas interlock, fire interlock, security checks)
  has not been rewritten or removed
- Gas > Fire > Security priority order is unchanged
- No valve topics (valve_01, valve_open, valve_close) appear anywhere
- Pump commands are rejected when gas or CO is active

Output a pass/fail table for every check above.
For each failure, show the exact line or function that needs fixing.
```

---

## 7. Prompt 4 — Arduino IDE Compile Error Fixer

**Use this prompt if the converted sketch produces compile errors in Arduino IDE.**

**Attach or paste with this prompt:**

- Current converted sketch (all parts)
- Full Arduino IDE compile error output (copy from the IDE output panel)

---

**Copy-paste prompt:**

```
The attached ESP32 Arduino sketch produces compile errors in Arduino IDE.
The compile error output is also attached or pasted below.

Fix ONLY the compile errors.

Rules — do NOT change:
- Local safety logic (gas interlock, fire interlock, security checks)
- Pin numbers
- Relay HIGH/LOW semantics
- Sensor thresholds or debounce logic
- Gas > Fire > Security priority
- MQTT topic strings or payload field names, unless the compile 
  error is caused by them
- Watchdog timer calls

If many errors are in the same function or block, output the 
corrected function or block only.
If errors span the entire sketch, output the full corrected sketch 
in numbered parts.

Do not include real Wi-Fi passwords.
Do not include real MQTT credentials.
Do not include raw RFID UID values.
```

---

## 8. Prompt 5 — Runtime / MQTT Troubleshooting

**Use this prompt if the sketch compiles but the ESP32 does not connect to Wi-Fi or MQTT, or heartbeat does not appear on the backend.**

**Attach or paste with this prompt:**

- Current converted sketch (all parts)
- Serial Monitor output from boot (copy the full boot log)
- MQTT connection error code if visible (e.g. `state=-2`)
- Which host and port are being used (without passwords)

---

**Copy-paste prompt:**

```
The ESP32 sketch compiles but is having a runtime or MQTT issue.
The Serial Monitor boot output and connection details are attached 
or pasted below.

Diagnose and fix only the networking or MQTT issue.

Possible issues to check:
- Wi-Fi connection timeout or wrong SSID (check for connection loop)
- MQTT broker host or port incorrect
- WiFiClientSecure used instead of WiFiClient for a plain port 1883 
  broker — switch to WiFiClient if so
- Missing mqtt.loop() call in the main loop
- mqtt.connect() client ID conflict
- NTP sync failure causing timestamp to be epoch 0 or year 1970
- Heartbeat not publishing every 30 seconds (check lastHeartbeatMs logic)
- MQTT packet too large for buffer (increase PubSubClient buffer if needed)
- Backend not showing esp32_home_01 as online (check topic string exactly:
  home/esp32_home_01/heartbeat)

Target broker for the current demo:
- host: smarthome-capstone.duckdns.org
- port: 1883
- TLS: no
- MQTT username/password: not required
- client class: WiFiClient (not WiFiClientSecure)

Do NOT ask for Wi-Fi passwords.
Do NOT ask for MQTT passwords.
Do NOT ask for raw RFID UIDs.

Output only the corrected functions or sections, not the full sketch, 
unless the issue affects the entire structure.
```

---

## 9. What to Send Back to the Software Team

Ask the MCH team to return these items when done:

1. **Sanitized converted sketch** — without any real credentials; Wi-Fi SSID/password replaced with placeholders
2. **`secrets.h.example`** — placeholder template only; no real credentials
3. **Arduino IDE compile result** — screenshot or copy of the output panel showing success or errors
4. **Serial Monitor boot output** — from the first power-on after flashing the new sketch
5. **MQTT connection result** — either "Connected" or the error state code (e.g. `state=-2`)
6. **Heartbeat confirmation** — confirmation that `[HEARTBEAT] OK` appears in Serial Monitor every 30 seconds
7. **List of any remaining compile or runtime errors** — exact error text
8. **RFID confirmation** — confirmation that raw RFID UID values were not pasted into WhatsApp, AI chat, or GitHub
9. **Safety logic confirmation** — confirmation that local gas/CO/fire/security logic was not rewritten or removed

---

## 10. Fast Success Target — Step 1 Only

**The first and only goal right now:**

```
1. ESP32 connects to Wi-Fi            → Serial shows [WiFi] Connected
2. ESP32 syncs NTP time               → Serial shows [NTP] Time synced
3. ESP32 connects to MQTT             → Serial shows [MQTT] Connected
4. Heartbeat published every 30 s     → Serial shows [HEARTBEAT] OK
5. Backend receives the heartbeat     → GET /api/devices shows esp32_home_01 online
```

Full telemetry, event publish, RFID access logs, and override subscribe come **after** the heartbeat works reliably.

Do not attempt to wire sensor events, RFID hashing, or override subscribe until heartbeat is confirmed end-to-end on the backend.

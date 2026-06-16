#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#include <Wire.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>
bool sensorWarmupComplete = false;

// ── SmartHome Network Integration ───────────────────────────────
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "mbedtls/sha256.h"
#include "secrets.h"

// ---- PIN CONFIGURATION ----
#define DHTPIN          15
#define DHTTYPE         DHT11

#define MQ2_PIN         35
#define MQ7_PIN         34
#define BUZZER_PIN      4
#define SERVO_PIN       13

#define SS_PIN          5
#define RST_PIN         -1

#define RELAY_RM1       32
#define RELAY_RM2       33
#define RELAY_KIT       25
#define RELAY_LIV       26

#define PIR_HALL        36
#define PIR_GAR         39
#define PIR_LIV         17
#define IMPACT_GAR      27
#define IMPACT_HALL     14

#define PCF8574_ADDR    0x20

// ---- SENSOR THRESHOLDS ----
const int MQ2_THRESHOLD        = 1500;
const int MQ7_THRESHOLD        = 3000;
const int FLAME_DEBOUNCE_LIMIT = 8;

const unsigned long CLIMATE_INTERVAL     = 2000;
const unsigned long TELEMETRY_PUBLISH_MS = 60000;
const unsigned long GAS_CYCLE_ALARM      = 5000;
const unsigned long GAS_CYCLE_SNIFF      = 2000;
const unsigned long SECURITY_SIREN_DUR   = 8000;

// ---- SMARTHOME MQTT CONSTANTS ----
const char* DEVICE_ID = "esp32_home_01";
#define TOPIC_HEARTBEAT       "home/esp32_home_01/heartbeat"
#define TOPIC_TELEMETRY       "home/esp32_home_01/telemetry"
#define TOPIC_EVENT           "home/esp32_home_01/event"
#define TOPIC_ACCESS          "home/esp32_home_01/access"
#define TOPIC_OVERRIDE_CMD    "home/esp32_home_01/cmd/override"
#define TOPIC_OVERRIDE_RESULT "home/esp32_home_01/override/result"
// Reserved dedicated command topics (compatibility). v1 backend publishes actions on
// cmd/override; these let the device also accept direct arm/disarm/reset/unlock commands.
#define TOPIC_CMD_ARM         "home/esp32_home_01/cmd/arm"
#define TOPIC_CMD_DISARM      "home/esp32_home_01/cmd/disarm"
#define TOPIC_CMD_RESET       "home/esp32_home_01/cmd/reset"
#define TOPIC_CMD_UNLOCK      "home/esp32_home_01/cmd/unlock"

// Room IDs per sensor group
const char* ROOM_GAS_MQ2    = "kitchen";
const char* ROOM_GAS_MQ7    = "garage";
const char* ROOM_PIR_HALL   = "hallway";
const char* ROOM_PIR_GAR    = "garage";
const char* ROOM_PIR_LIV    = "living_room";
const char* ROOM_IMPACT_GAR  = "garage";
const char* ROOM_IMPACT_HALL = "hallway";

// PCF8574 bits 0-3: flame zones (active LOW)
// PCF8574 bits 4-6: reed/window sensors (HIGH = open)
const char* FLAME_ROOMS[4]  = { "bedroom_1", "bedroom_2", "kitchen", "living_room" };
const char* WINDOW_ROOMS[3] = { "bedroom_1", "bedroom_2", "kitchen" };

const unsigned long HEARTBEAT_INTERVAL_MS = 30000UL;

// ---- EVENT COOLDOWN ----
// Prevents duplicate events per zone within this window.
// gas_detected / co_detected use state-change logic so they are unaffected.
const unsigned long EVENT_COOLDOWN_MS = 30000UL;

unsigned long lastFireEventMs[4] = {0, 0, 0, 0}; // index matches FLAME_ROOMS

// ---- SYSTEM REGISTERS ----
bool systemActive = true;
bool systemArmed  = true;
// Device-reported / last-commanded door lock state (no physical lock sensor).
// Boot calls lockDoor() so the door starts LOCKED. Kept in sync by lockDoor()/
// unlockDoor() (including the hazard auto-unlock), and reported in the heartbeat.
bool doorLocked   = true;

bool mq2Hazard = false;
bool mq7Hazard = false;

int  flameDebounceCounter = 0;
byte activeFlameZone      = 0xFF;

unsigned long lastBuzzerToggle    = 0;
bool          buzzerState         = false;
unsigned long gasTimerMarker      = 0;
unsigned long securitySirenMarker = 0;
bool          securityAlarmActive = false;

// ---- MQTT STATE ----
WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastHeartbeatMs = 0;
unsigned long lastTelemetryMs = 0;

bool lastMq2HazardPublished    = false;
bool lastMq7HazardPublished    = false;
byte lastPublishedFlameZone    = 0xFF;
bool lastWindowOpenPublished[3] = { false, false, false };

// Last valid DHT reading — cached so non-climate rooms don't block telemetry
float lastGoodTemp = NAN;
float lastGoodHum  = NAN;

// ---- OVERRIDE REGISTERS ----
bool manualAlarmActive = false;
bool manualPumpRm1     = false;
bool manualPumpRm2     = false;
bool manualPumpKit     = false;
bool manualPumpLiv     = false;

DHT      dht(DHTPIN, DHTTYPE);
MFRC522  mfrc522(SS_PIN, RST_PIN);
Servo    mainDoorServo;

// ---------------------------------------------------------
// WATCHDOG TIMER
// ---------------------------------------------------------
hw_timer_t *watchdogTimer = NULL;
void IRAM_ATTR watchdogTrigger() { esp_restart(); }

// ---------------------------------------------------------
// UTILITY & HASHING
// ---------------------------------------------------------
String isoTimestamp() {
  time_t now; time(&now);
  struct tm *t = gmtime(&now);
  char buf[25];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
           t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

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

String makeEventId()  { return "evt_" + String(millis()); }
String makeAccessId() { return "acc_" + String(millis()); }

// ---------------------------------------------------------
// MQTT PUBLISHERS
// ---------------------------------------------------------
void publishHeartbeat() {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  doc["device_id"]        = DEVICE_ID;
  doc["status"]           = "online";
  doc["firmware_version"] = "mch-integrated-v3";
  doc["uptime_seconds"]   = millis() / 1000;
  doc["wifi_rssi"]        = WiFi.RSSI();
  doc["security_armed"]   = systemArmed;
  doc["door_locked"]      = doorLocked;
  doc["timestamp"]        = isoTimestamp();

  char payload[256];
  serializeJson(doc, payload);
  bool ok = mqtt.publish(TOPIC_HEARTBEAT, payload, false);

  if (Serial) {
    Serial.print("[HEARTBEAT] ");
    Serial.println(ok ? "OK" : "FAILED");
  }
}

// Publishes one telemetry record for a single room.
// Pass -1 for gasRaw / coRaw to omit those fields.
// Pass NAN for temp / hum to omit climate fields.
void publishTelemetryRoom(const char* roomId,
                          float temp, float hum,
                          int gasRaw, int coRaw,
                          bool flame, bool motion, bool reed) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["room_id"]   = roomId;
  if (!isnan(temp))  doc["temperature_c"]    = temp;
  if (!isnan(hum))   doc["humidity_percent"] = hum;
  if (gasRaw >= 0)   doc["gas_raw"]          = gasRaw;
  if (coRaw  >= 0)   doc["co_raw"]           = coRaw;
  doc["flame_detected"]  = flame;
  doc["motion_detected"] = motion;
  doc["reed_open"]       = reed;
  doc["timestamp"]       = isoTimestamp();

  char payload[300];
  serializeJson(doc, payload);
  bool ok = mqtt.publish(TOPIC_TELEMETRY, payload, false);

  if (Serial) {
    Serial.printf("[TELEMETRY] %-12s %s\n", roomId, ok ? "OK" : "FAILED");
  }
}

void publishEvent(const char* eventType, const char* severity,
                  const char* room, int value = -1) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  doc["event_id"]   = makeEventId();
  doc["device_id"]  = DEVICE_ID;
  doc["room_id"]    = room;
  doc["event_type"] = eventType;
  doc["severity"]   = severity;
  doc["message"]    = String(eventType) + " in " + String(room);
  if (value != -1) doc["raw_value"] = value;
  doc["timestamp"]  = isoTimestamp();

  char payload[300];
  serializeJson(doc, payload);
  bool ok = mqtt.publish(TOPIC_EVENT, payload, false);

  if (Serial) {
    Serial.printf("[EVENT] %s @ %s  %s\n", eventType, room, ok ? "OK" : "FAILED");
  }
}

void publishAccess(byte* uid, byte uidLen, bool granted) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  doc["access_id"]     = makeAccessId();
  doc["device_id"]     = DEVICE_ID;
  doc["gate_id"]       = "main_door";
  doc["user_id"]       = "usr_unknown";
  doc["access_method"] = "nfc";
  doc["result"]        = granted ? "granted" : "denied";
  doc["card_uid_hash"] = hashUid(uid, uidLen);
  doc["timestamp"]     = isoTimestamp();

  char payload[300];
  serializeJson(doc, payload);
  mqtt.publish(TOPIC_ACCESS, payload, false);
}

void publishAck(const char* overrideId, const char* actuatorId,
                const char* action, const char* result,
                const char* reason = NULL) {
  if (!mqtt.connected()) return;
  JsonDocument doc;
  if (overrideId != NULL) doc["override_id"] = overrideId;
  doc["device_id"] = DEVICE_ID;
  if (actuatorId != NULL) doc["actuator_id"] = actuatorId;
  doc["action"]    = action;
  doc["result"]    = result;
  doc["blocked_reason"] = (reason != NULL) ? reason : nullptr;
  doc["timestamp"] = isoTimestamp();

  char payload[300];
  serializeJson(doc, payload);
  mqtt.publish(TOPIC_OVERRIDE_RESULT, payload, false);
}

// ---------------------------------------------------------
// MQTT CALLBACK (OVERRIDES)
// ---------------------------------------------------------
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);

  const char* overrideId = doc["override_id"];
  const char* actuatorId = doc["actuator_id"];

  // Resolve the action. The shared cmd/override topic carries it in the JSON
  // "action" field; the reserved dedicated topics (cmd/arm, cmd/disarm, cmd/reset,
  // cmd/unlock) imply the action from the topic itself and may have an empty body.
  String topicStr = String(topic);
  String cmd;
  if      (topicStr.endsWith("/cmd/arm"))    cmd = "arm";
  else if (topicStr.endsWith("/cmd/disarm")) cmd = "disarm";
  else if (topicStr.endsWith("/cmd/reset"))  cmd = "maintenance_reset";
  else if (topicStr.endsWith("/cmd/unlock")) cmd = "door_unlock";
  else {
    if (err) return;                       // cmd/override with an unparseable body
    const char* action = doc["action"];
    if (!action) return;
    cmd = String(action);
  }
  const char* actionStr = cmd.c_str();
  if (Serial) Serial.printf("[OVERRIDE] topic=%s action=%s\n", topic, actionStr);

  // door_lock — physical door control. Blocked while a fire/gas/CO hazard is active so
  // evacuation is never trapped behind a locked door. Honest ACK: report "failed" rather
  // than locking and falsely ACKing "executed". Does NOT change systemArmed.
  if (cmd == "door_lock") {
    if (mq2Hazard || mq7Hazard || activeFlameZone != 0xFF) {
      if (Serial) Serial.println("[OVERRIDE] door_lock REJECTED — evacuation hazard active");
      publishAck(overrideId, actuatorId, actionStr, "failed", "door_lock_blocked_hazard");
      return;
    }
    lockDoor();
    publishAck(overrideId, actuatorId, actionStr, "executed");
    return;
  }
  // door_unlock — allowed at all times (evacuation may require it). Does NOT change systemArmed.
  if (cmd == "door_unlock") {
    unlockDoor();
    publishAck(overrideId, actuatorId, actionStr, "executed");
    return;
  }

  // ARM / DISARM — security/intrusion monitoring mode ONLY. They set systemArmed (and
  // disarm clears the SECURITY siren state). They must NOT touch the physical door
  // (door_lock / door_unlock are separate controls) and must NOT mute an active
  // fire/gas/CO siren: the safety-first loop owns hazard actuators, so fire/gas/CO
  // detection and suppression continue regardless of arm/disarm.
  if (cmd == "arm") {
    systemArmed = true;
    publishAck(overrideId, actuatorId, actionStr, "executed");
    return;
  }
  if (cmd == "disarm") {
    systemArmed = false;
    securityAlarmActive = false;             // clear intrusion/security siren state
    // Only silence the buzzer when NO hazard is active — never mute fire/gas/CO.
    if (!(mq2Hazard || mq7Hazard) && activeFlameZone == 0xFF) {
      digitalWrite(BUZZER_PIN, LOW);
    }
    publishAck(overrideId, actuatorId, actionStr, "executed");
    return;
  }

  // Confirm Threat Cleared (admin false-alarm recovery). Never clears gas/CO, and
  // refuses to release suppression while flame is still physically present. It does
  // NOT disable future hazard monitoring — the sensor checks run every loop tick.
  if (cmd == "maintenance_reset") {
    if (mq2Hazard || mq7Hazard) {
      if (Serial) Serial.println("[OVERRIDE] maintenance_reset REJECTED — gas/CO active");
      publishAck(overrideId, actuatorId, actionStr, "failed", "gas_co_active");
      return;
    }
    // Read PCF8574 flame bits right now (bits 0-3, active LOW = flame present).
    byte pcfData = 0xFF;
    Wire.beginTransmission(PCF8574_ADDR);
    if (Wire.endTransmission() == 0) {
      Wire.requestFrom((uint8_t)PCF8574_ADDR, (uint8_t)1);
      if (Wire.available()) pcfData = Wire.read();
    }
    byte flameBits = pcfData & 0x0F;
    if (flameBits < 0x0F) {
      if (Serial) Serial.println("[OVERRIDE] maintenance_reset REJECTED — flame still present");
      publishAck(overrideId, actuatorId, actionStr, "failed", "fire_still_present");
      return;
    }
    // Flame verified clear: release the fire latch, clear manual/alarm flags, pumps off.
    flameDebounceCounter   = 0;
    activeFlameZone        = 0xFF;
    lastPublishedFlameZone = 0xFF;
    manualPumpRm1 = manualPumpRm2 = manualPumpKit = manualPumpLiv = false;
    manualAlarmActive   = false;
    securityAlarmActive = false;
    setAllRelays(HIGH);                      // relays active-LOW; HIGH = pumps OFF
    digitalWrite(BUZZER_PIN, LOW);
    if (Serial) Serial.println("[OVERRIDE] maintenance_reset — fire latch cleared, pumps OFF");
    publishAck(overrideId, actuatorId, actionStr, "executed");
    return;
  }

  // Gas/CO lockout: never start a pump or test the buzzer while gas/CO is active.
  if (mq2Hazard || mq7Hazard) {
    if (cmd == "pump_on" || cmd == "buzzer_on") {
      if (Serial) Serial.println("[OVERRIDE] REJECTED — Gas/CO active");
      publishAck(overrideId, actuatorId, actionStr, "failed", "gas_co_lockout");
      return;
    }
  }

  if (cmd == "buzzer_on") {
    manualAlarmActive = true;
    publishAck(overrideId, actuatorId, actionStr, "executed");
  } else if (cmd == "buzzer_off") {
    manualAlarmActive = false;
    publishAck(overrideId, actuatorId, actionStr, "executed");
  } else if (cmd == "pump_on") {
    if (String(actuatorId) == "pump_rm1_01") manualPumpRm1 = true;
    else if (String(actuatorId) == "pump_rm2_01") manualPumpRm2 = true;
    else if (String(actuatorId) == "pump_kit_01") manualPumpKit = true;
    else if (String(actuatorId) == "pump_liv_01") manualPumpLiv = true;
    publishAck(overrideId, actuatorId, actionStr, "executed");
  } else if (cmd == "pump_off") {
    // Honest ACK: while a fire latch owns the relay, the thermal interlock keeps
    // suppression running, so pump_off cannot actually stop the pump. Report it
    // as failed instead of a misleading "executed". Use maintenance_reset to
    // release suppression after the threat is verified clear.
    if (activeFlameZone != 0xFF) {
      if (Serial) Serial.println("[OVERRIDE] pump_off REJECTED — fire suppression active");
      publishAck(overrideId, actuatorId, actionStr, "failed", "fire_active");
      return;
    }
    manualPumpRm1 = manualPumpRm2 = manualPumpKit = manualPumpLiv = false;
    publishAck(overrideId, actuatorId, actionStr, "executed");
  } else {
    // Any action the firmware does not implement (e.g. system_reset, typos).
    if (Serial) Serial.printf("[OVERRIDE] unknown action: %s\n", actionStr);
    publishAck(overrideId, actuatorId, actionStr, "failed", "unknown_action");
  }
}

// Subscribe to every backend-to-device command topic. Called on first connect and on
// every reconnect so the device keeps accepting commands after a network drop.
void subscribeCommandTopics() {
  mqtt.subscribe(TOPIC_OVERRIDE_CMD);
  mqtt.subscribe(TOPIC_CMD_ARM);
  mqtt.subscribe(TOPIC_CMD_DISARM);
  mqtt.subscribe(TOPIC_CMD_RESET);
  mqtt.subscribe(TOPIC_CMD_UNLOCK);
}

// ---------------------------------------------------------
// NETWORK CONNECTION LOGIC
// ---------------------------------------------------------

// Blocking initial WiFi connect — called once at power-on.
// Disables brownout detector during the RF spike; re-enables after.
void connectWiFi() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  if (Serial) { Serial.print("\n[WiFi] Connecting to "); Serial.println(WIFI_SSID); }
  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    if (Serial) Serial.print('.');
    if (watchdogTimer != NULL) timerWrite(watchdogTimer, 0);
    if (millis() - start > 15000) {
      if (Serial) Serial.println("\n[WiFi] Timeout — will retry in background");
      WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);
      return;
    }
  }
  if (Serial) Serial.println("\n[WiFi] Connected!");
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);
}

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = 0;
  unsigned long start = millis();
  while (now < 1000000000UL) {
    delay(200);
    time(&now);
    if (watchdogTimer != NULL) timerWrite(watchdogTimer, 0);
    if (millis() - start > 10000) return;
  }
  if (Serial) Serial.println("[NTP] Time synced");
}

// Non-blocking background network manager — runs every loop tick.
// FIX: mqtt.setServer / setCallback / setBufferSize / setKeepAlive are
// configured unconditionally in setup() so they are always valid,
// even when WiFi was not available at boot time.
void ensureMqttConnected() {
  if (mqtt.connected()) return;

  static unsigned long lastWifiAttemptMs = 0;
  static unsigned long lastMqttAttemptMs = 0;
  unsigned long now = millis();

  // --- WiFi layer ---
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiAttemptMs >= 15000) {
      lastWifiAttemptMs = now;
      if (Serial) Serial.println("[WiFi] Link missing — retrying...");
      WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
      WiFi.disconnect(true);
      delay(100);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 1);
    }
    return; // Can't attempt MQTT without WiFi — return and keep safety loop running
  }

  // --- MQTT layer (WiFi is up) ---
  if (now - lastMqttAttemptMs >= 10000) {
    lastMqttAttemptMs = now;
    if (Serial) Serial.println("[MQTT] Link dropped — reconnecting...");
    if (mqtt.connect(DEVICE_ID)) {
      if (Serial) Serial.println("[MQTT] Reconnected!");
      subscribeCommandTopics();

      // Re-sync time on reconnect in case NTP failed at boot
      if (now < 60000) syncTime();
    }
  }
}

// ---------------------------------------------------------
// SERVO
// ---------------------------------------------------------
void lockDoor() {
  mainDoorServo.attach(SERVO_PIN, 500, 2400);
  mainDoorServo.write(0);
  delay(400);
  mainDoorServo.detach();
  doorLocked = true;
}

void unlockDoor() {
  mainDoorServo.attach(SERVO_PIN, 500, 2400);
  mainDoorServo.write(180);
  delay(400);
  mainDoorServo.detach();
  doorLocked = false;
}

// ---------------------------------------------------------
// SETUP
// ---------------------------------------------------------
void setup() {
  delay(1000);
  Serial.begin(115200);

  // 1. HARDWARE INIT
  Wire.begin(21, 22);
  Wire.beginTransmission(PCF8574_ADDR);
  Wire.write(0xFF);
  Wire.endTransmission();

  SPI.begin();
  mfrc522.PCD_Init();

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(MQ7_PIN, INPUT);
  pinMode(PIR_HALL, INPUT_PULLDOWN);
  pinMode(PIR_GAR,  INPUT_PULLDOWN);
  pinMode(PIR_LIV,  INPUT_PULLDOWN);
  pinMode(IMPACT_GAR,  INPUT);
  pinMode(IMPACT_HALL, INPUT);

  pinMode(RELAY_RM1, OUTPUT);
  pinMode(RELAY_RM2, OUTPUT);
  pinMode(RELAY_KIT, OUTPUT);
  pinMode(RELAY_LIV, OUTPUT);

  setAllRelays(HIGH);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  mainDoorServo.setPeriodHertz(50);
  lockDoor();

  dht.begin();
  if (Serial) Serial.println("\n--- SMART FACILITY SYSTEM ONLINE ---");

  // 2. WATCHDOG
  watchdogTimer = timerBegin(1000000);
  timerAttachInterrupt(watchdogTimer, &watchdogTrigger);
  timerAlarm(watchdogTimer, 30000000, true, 0);

  // 3. MQTT CLIENT CONFIG — done here unconditionally so it is always valid,
  //    even if WiFi fails at boot and connectMqtt() is never called.
  //    ensureMqttConnected() in the loop only calls mqtt.connect(), which
  //    requires these to already be set.
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(60);
  mqtt.setBufferSize(512);
  mqtt.setCallback(onMqttMessage);

  delay(1000); // inrush current recovery before WiFi RF spike

  // 4. NETWORK — blocking at boot only; background fallback handles failure
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    syncTime();
    if (mqtt.connect(DEVICE_ID)) {
      if (Serial) Serial.println("[MQTT] Connected");
      subscribeCommandTopics();
    }
  }
}

// ---------------------------------------------------------
// MAIN LOOP (SAFETY-FIRST)
// ---------------------------------------------------------
void loop() {
  timerWrite(watchdogTimer, 0);

  // PRIORITY 1: Physical safety hazards — evaluated every tick
  bool gasActive     = checkGasHazards();
  bool thermalActive = checkThermalHazards();

  if (gasActive) {
    executeGasInterlock();
    securityAlarmActive = false;
    applyManualOverrides();
  } else if (thermalActive) {
    executeThermalInterlock();
    securityAlarmActive = false;
    applyManualOverrides();
  } else {
    // PRIORITY 2: Routine security and actuation
    setAllRelays(HIGH);

    if (systemArmed) {
      if (checkSecurityBreaches()) {
        securityAlarmActive = true;
        securitySirenMarker = millis();
      }
      if (securityAlarmActive) handleSecuritySiren();
      else                     digitalWrite(BUZZER_PIN, LOW);
    } else {
      securityAlarmActive = false;
      digitalWrite(BUZZER_PIN, LOW);
    }

    handleSerialConsole();
    if (systemActive) {
      handleRFIDAccess();
      processEverydayLogistics();
      applyManualOverrides();
    }
  }

  // PRIORITY 3: Background cloud communication (non-blocking)
  ensureMqttConnected();
  if (mqtt.connected()) {
    mqtt.loop();
    if (millis() - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeatMs = millis();
      publishHeartbeat();
    }
  }
}

// ---------------------------------------------------------
// SENSOR CHECKS & ALARMS
// ---------------------------------------------------------

// gas_detected / co_detected use state-change deduplication and are fully
// independent from the fire/motion EVENT_COOLDOWN_MS timers.
bool checkGasHazards() {
  if (millis() < 60000) return false;

  int mq2Val = analogRead(MQ2_PIN);
  int mq7Val = analogRead(MQ7_PIN);

  mq2Hazard = (mq2Val > MQ2_THRESHOLD);
  mq7Hazard = (mq7Val > MQ7_THRESHOLD);

  if (mq2Hazard && !lastMq2HazardPublished) {
    publishEvent("gas_detected", "critical", ROOM_GAS_MQ2, mq2Val);
    lastMq2HazardPublished = true;
  } else if (!mq2Hazard) {
    lastMq2HazardPublished = false;
  }

  if (mq7Hazard && !lastMq7HazardPublished) {
    publishEvent("co_detected", "critical", ROOM_GAS_MQ7, mq7Val);
    lastMq7HazardPublished = true;
  } else if (!mq7Hazard) {
    lastMq7HazardPublished = false;
  }

  return (mq2Hazard || mq7Hazard);
}

void executeGasInterlock() {
  setAllRelays(HIGH);
  unlockDoor();
  systemArmed = false;

  unsigned long currentMillis = millis();
  if (gasTimerMarker == 0) gasTimerMarker = currentMillis;
  unsigned long elapsed = currentMillis - gasTimerMarker;

  if (elapsed < GAS_CYCLE_ALARM)                           asynchronousSirenPulse(100);
  else if (elapsed < (GAS_CYCLE_ALARM + GAS_CYCLE_SNIFF))  digitalWrite(BUZZER_PIN, LOW);
  else                                                      gasTimerMarker = currentMillis;
}

// fire_detected: one event per zone per EVENT_COOLDOWN_MS.
// Sensor bounce cannot produce a second event within the cooldown window
// even if activeFlameZone briefly resets to 0xFF between readings.
bool checkThermalHazards() {
  Wire.beginTransmission(PCF8574_ADDR);
  if (Wire.endTransmission() != 0) return false;

  Wire.requestFrom((uint8_t)PCF8574_ADDR, (uint8_t)1);
  if (!Wire.available()) return false;

  byte pcfData   = Wire.read();
  byte flameBits = pcfData & 0x0F;

  if (flameBits < 0x0F) {
    flameDebounceCounter++;
    if (flameDebounceCounter >= FLAME_DEBOUNCE_LIMIT) {
      activeFlameZone = flameBits;

      unsigned long now = millis();
      for (int i = 0; i < 4; i++) {
        bool newlyOnFire = (bitRead(activeFlameZone, i) == 0) &&
                           (bitRead(lastPublishedFlameZone, i) == 1);
        if (newlyOnFire && (now - lastFireEventMs[i] >= EVENT_COOLDOWN_MS)) {
          publishEvent("fire_detected", "critical", FLAME_ROOMS[i]);
          lastFireEventMs[i] = now;
        }
      }
      lastPublishedFlameZone = activeFlameZone;
      return true;
    }
  } else {
    flameDebounceCounter   = 0;
    activeFlameZone        = 0xFF;
    lastPublishedFlameZone = 0xFF;
  }
  return false;
}

void executeThermalInterlock() {
  asynchronousSirenPulse(400);
  unlockDoor();
  systemArmed = false;

  digitalWrite(RELAY_RM1, (bitRead(activeFlameZone, 0) == 0) ? LOW : HIGH);
  digitalWrite(RELAY_RM2, (bitRead(activeFlameZone, 1) == 0) ? LOW : HIGH);
  digitalWrite(RELAY_KIT, (bitRead(activeFlameZone, 2) == 0) ? LOW : HIGH);
  digitalWrite(RELAY_LIV, (bitRead(activeFlameZone, 3) == 0) ? LOW : HIGH);
}

// Security events each have their own cooldown timer so different zones
// and different event types never block each other.
bool checkSecurityBreaches() {
  bool breachDetected = false;
  unsigned long now = millis();

  // PIR sensors
  static bool          lastPirHall = LOW, lastPirGar = LOW, lastPirLiv = LOW;
  static unsigned long lastMotionHallMs = 0, lastMotionGarMs = 0, lastMotionLivMs = 0;

  bool currentPirHall = digitalRead(PIR_HALL);
  bool currentPirGar  = digitalRead(PIR_GAR);
  bool currentPirLiv  = digitalRead(PIR_LIV);

  if (now > 30000) {
    if (currentPirHall == HIGH && lastPirHall == LOW &&
        (now - lastMotionHallMs >= EVENT_COOLDOWN_MS)) {
      publishEvent("motion_detected", "warning", ROOM_PIR_HALL);
      lastMotionHallMs = now; breachDetected = true;
    }
    if (currentPirGar == HIGH && lastPirGar == LOW &&
        (now - lastMotionGarMs >= EVENT_COOLDOWN_MS)) {
      publishEvent("motion_detected", "warning", ROOM_PIR_GAR);
      lastMotionGarMs = now; breachDetected = true;
    }
    if (currentPirLiv == HIGH && lastPirLiv == LOW &&
        (now - lastMotionLivMs >= EVENT_COOLDOWN_MS)) {
      publishEvent("motion_detected", "warning", ROOM_PIR_LIV);
      lastMotionLivMs = now; breachDetected = true;
    }
  }
  lastPirHall = currentPirHall;
  lastPirGar  = currentPirGar;
  lastPirLiv  = currentPirLiv;

  // Impact sensors
  static bool          lastImpactGar = false, lastImpactHall = false;
  static unsigned long lastImpactGarMs = 0,   lastImpactHallMs = 0;

  bool curImpactGar  = (digitalRead(IMPACT_GAR)  == HIGH);
  bool curImpactHall = (digitalRead(IMPACT_HALL) == HIGH);

  if (curImpactGar && !lastImpactGar &&
      (now - lastImpactGarMs >= EVENT_COOLDOWN_MS)) {
    publishEvent("vibration_detected", "warning", ROOM_IMPACT_GAR);
    lastImpactGarMs = now; breachDetected = true;
  }
  if (curImpactHall && !lastImpactHall &&
      (now - lastImpactHallMs >= EVENT_COOLDOWN_MS)) {
    publishEvent("vibration_detected", "warning", ROOM_IMPACT_HALL);
    lastImpactHallMs = now; breachDetected = true;
  }
  lastImpactGar  = curImpactGar;
  lastImpactHall = curImpactHall;

  // Reed / window sensors via PCF8574 bits 4-6
  static unsigned long lastReedMs[3] = {0, 0, 0};

  Wire.beginTransmission(PCF8574_ADDR);
  if (Wire.endTransmission() == 0) {
    Wire.requestFrom((uint8_t)PCF8574_ADDR, (uint8_t)1);
    if (Wire.available()) {
      byte pcfData = Wire.read();
      for (int i = 0; i < 3; i++) {
        bool windowOpen = (bitRead(pcfData, 4 + i) == 1);
        if (windowOpen && !lastWindowOpenPublished[i] &&
            (now - lastReedMs[i] >= EVENT_COOLDOWN_MS)) {
          publishEvent("reed_switch_opened", "warning", WINDOW_ROOMS[i]);
          lastReedMs[i] = now; breachDetected = true;
        }
        lastWindowOpenPublished[i] = windowOpen;
      }
    }
  }
  return breachDetected;
}

void handleSecuritySiren() {
  if (millis() - securitySirenMarker < SECURITY_SIREN_DUR) asynchronousSirenPulse(800);
  else                                                       securityAlarmActive = false;
}

// Returns true if the scanned UID matches one of the authorized cards. Authorized UIDs
// are kept out of source control: define AUTHORIZED_RFID_UID_1..3 in secrets.h (see
// secrets.example.h). Raw UID values are never logged or committed — only the boolean
// match result is used downstream.
bool isAuthorizedUid(const String& scannedUID) {
  return scannedUID == String(AUTHORIZED_RFID_UID_1) ||
         scannedUID == String(AUTHORIZED_RFID_UID_2) ||
         scannedUID == String(AUTHORIZED_RFID_UID_3);
}

void handleRFIDAccess() {
  static unsigned long lastRFIDCheck = 0;
  if (millis() - lastRFIDCheck < 1000) return;
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) return;
  lastRFIDCheck = millis();

  String scannedUID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    scannedUID += String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " ");
    scannedUID += String(mfrc522.uid.uidByte[i], HEX);
  }
  scannedUID.trim();
  scannedUID.toUpperCase();

  // Match against authorized UIDs from secrets.h (AUTHORIZED_RFID_UID_1..3).
  // The raw scanned UID is never printed; only the access decision is logged.
  bool granted = isAuthorizedUid(scannedUID);

  if (granted) {
    systemArmed = !systemArmed;
    if (systemArmed) {
      lockDoor();
      if (Serial) Serial.println("\n[RFID] ARMED.");
    } else {
      unlockDoor();
      securityAlarmActive = false;
      digitalWrite(BUZZER_PIN, LOW);
      if (Serial) Serial.println("\n[RFID] DISARMED.");
    }
  } else {
    digitalWrite(BUZZER_PIN, HIGH); delay(150); digitalWrite(BUZZER_PIN, LOW);
  }

  publishAccess(mfrc522.uid.uidByte, mfrc522.uid.size, granted);
  mfrc522.PICC_HaltA();
}

// Publishes one telemetry message per room every TELEMETRY_PUBLISH_MS.
// DHT is read every CLIMATE_INTERVAL and cached — other rooms don't wait
// for a successful climate read.
void processEverydayLogistics() {
  static unsigned long lastClimateRead = 0;

  // Refresh DHT cache every 2 seconds
  if (millis() - lastClimateRead >= CLIMATE_INTERVAL) {
    lastClimateRead = millis();
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
      lastGoodTemp = t;
      lastGoodHum  = h;
    }
  }

  // Publish all rooms once per minute
  if (millis() - lastTelemetryMs < TELEMETRY_PUBLISH_MS) return;

  // Read PCF8574 for flame and reed sensor state
  byte pcfData = 0xFF; // safe default: no flame, no reed open
  Wire.beginTransmission(PCF8574_ADDR);
  if (Wire.endTransmission() == 0) {
    Wire.requestFrom((uint8_t)PCF8574_ADDR, (uint8_t)1);
    if (Wire.available()) pcfData = Wire.read();
  }

  // PCF8574 bits 0-3: flame zones (active LOW = fire detected)
  bool flameBed1 = (bitRead(pcfData, 0) == 0);
  bool flameBed2 = (bitRead(pcfData, 1) == 0);
  bool flameKit  = (bitRead(pcfData, 2) == 0);
  bool flameLiv  = (bitRead(pcfData, 3) == 0);

  // PCF8574 bits 4-6: reed/window sensors (HIGH = open)
  bool reedBed1 = (bitRead(pcfData, 4) == 1);
  bool reedBed2 = (bitRead(pcfData, 5) == 1);
  bool reedKit  = (bitRead(pcfData, 6) == 1);

  int  mq2Val  = analogRead(MQ2_PIN);
  int  mq7Val  = analogRead(MQ7_PIN);
  bool pirLiv  = digitalRead(PIR_LIV);
  bool pirGar  = digitalRead(PIR_GAR);
  bool pirHall = digitalRead(PIR_HALL);

  // One message per room — each carries only the sensors in that room
  //                   room          temp          hum           gas     co      flame      motion   reed
  publishTelemetryRoom("living_room", lastGoodTemp, lastGoodHum,  -1,     -1,     flameLiv,  pirLiv,  false);
  publishTelemetryRoom("kitchen",     NAN,          NAN,          mq2Val, -1,     flameKit,  false,   reedKit);
  publishTelemetryRoom("garage",      NAN,          NAN,          -1,     mq7Val, false,     pirGar,  false);
  publishTelemetryRoom("hallway",     NAN,          NAN,          -1,     -1,     false,     pirHall, false);
  publishTelemetryRoom("bedroom_1",   NAN,          NAN,          -1,     -1,     flameBed1, false,   reedBed1);
  publishTelemetryRoom("bedroom_2",   NAN,          NAN,          -1,     -1,     flameBed2, false,   reedBed2);

  lastTelemetryMs = millis();
}

void applyManualOverrides() {
  if (!(mq2Hazard || mq7Hazard) && activeFlameZone == 0xFF) {
    if (manualPumpRm1) digitalWrite(RELAY_RM1, LOW);
    if (manualPumpRm2) digitalWrite(RELAY_RM2, LOW);
    if (manualPumpKit) digitalWrite(RELAY_KIT, LOW);
    if (manualPumpLiv) digitalWrite(RELAY_LIV, LOW);
  }
  if (!(mq2Hazard || mq7Hazard)) {
    if (manualAlarmActive && !securityAlarmActive) {
      digitalWrite(BUZZER_PIN, HIGH);
    }
  }
}

void asynchronousSirenPulse(int rateMs) {
  if (millis() - lastBuzzerToggle >= (unsigned long)rateMs) {
    buzzerState = !buzzerState;
    digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    lastBuzzerToggle = millis();
  }
}

void setAllRelays(byte state) {
  digitalWrite(RELAY_RM1, state);
  digitalWrite(RELAY_RM2, state);
  digitalWrite(RELAY_KIT, state);
  digitalWrite(RELAY_LIV, state);
}

void handleSerialConsole() {
  if (!Serial.available()) return;
  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toUpperCase();
  if      (command == "START")  { systemActive = true; }
  else if (command == "STOP")   { systemActive = false; securityAlarmActive = false; digitalWrite(BUZZER_PIN, LOW); setAllRelays(HIGH); }
  else if (command == "ARM")    { systemArmed  = true;  lockDoor(); }
  else if (command == "DISARM") { systemArmed  = false; securityAlarmActive = false; digitalWrite(BUZZER_PIN, LOW); unlockDoor(); }
}

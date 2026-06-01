# MQTTX Manual Test Report
## Purpose
This document records the manual MQTTX verification test for the Autonomous Smart Home Security backend.
The goal of this test is to prove that the backend can publish an MQTT override command after receiving a REST API override request.
## Test Date
2026-06-01
## Test Components
- Local MQTT broker
- Backend Node.js API
- MongoDB Atlas
- MQTTX Desktop client
- PowerShell REST request
## Verified Flow
REST API /api/overrides
-> MongoDB OverrideRequest record
-> backend MQTT command publish
-> local MQTT broker
-> MQTTX subscribed client receives command payload
## Backend Result
The backend returned:
- created: true
- mqtt_publish.published: true
- mqtt_publish.skipped: false
- topic: home/esp32_home_01/command/override
- next_step: Override command published to MQTT.
## MQTTX Subscription
MQTTX subscribed to:
home/+/command/override
## Received Command Topic
home/esp32_home_01/command/override
## Received Command Payload Example
{
  "override_id": "ovr_1780350008569_40565",
  "device_id": "esp32_home_01",
  "actuator_id": "buzzer_01",
  "action": "buzzer_off",
  "requested_by": "usr_admin_001",
  "reason": "MQTTX manual command test.",
  "timestamp": "2026-06-01T21:40:08.634Z"
}
## Broker Verification
The local broker printed:
- client connected: smart_home_backend_manual_test
- smart_home_backend_manual_test subscribed to device-to-backend topics
- client connected: mqttx_manual_test
- mqttx_manual_test subscribed to home/+/command/override
- message from smart_home_backend_manual_test on home/esp32_home_01/command/override
## Conclusion
The manual MQTTX test passed.
This confirms that the backend can act as an MQTT command publisher for future ESP32 override commands.

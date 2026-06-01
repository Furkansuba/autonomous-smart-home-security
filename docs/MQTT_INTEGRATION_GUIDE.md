# MQTT Integration Guide
This document summarizes the MQTT integration of the Autonomous Smart Home Security backend.
## MQTT Status
The backend now supports:
- MQTT client configuration
- local MQTT broker for development
- mock MQTT publisher
- MQTT message parsing
- MQTT topic routing
- MQTT payload ingestion
- MongoDB persistence from MQTT messages
- MQTT override command publishing
- local MQTT end-to-end tests
## Local Broker
Run from backend directory:
npm run mqtt:broker
Default broker URL:
mqtt://localhost:1883
The local broker uses Aedes and listens on TCP port 1883.
## Mock Device Publisher
Run from backend directory while the broker is running:
npm run mqtt:publish:mock
Publishes example messages to:
- home/esp32_home_01/heartbeat
- home/esp32_home_01/telemetry
- home/esp32_home_01/event
- home/esp32_home_01/access
- home/esp32_home_01/override/result
## Backend MQTT Environment
Local .env values:
MQTT_ENABLED=false
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart_home_backend
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_SUBSCRIBE_TOPICS=home/+/heartbeat,home/+/telemetry,home/+/event,home/+/access,home/+/override/result
## Backend Subscribed Topics
The backend subscribes to:
home/+/heartbeat
home/+/telemetry
home/+/event
home/+/access
home/+/override/result
These topics are device-to-backend topics.
## Backend Published Command Topic
The backend publishes override commands to:
home/{device_id}/command/override
Example:
home/esp32_home_01/command/override
Command payload:
{
  "override_id": "ovr_...",
  "device_id": "esp32_home_01",
  "actuator_id": "buzzer_01",
  "action": "buzzer_off",
  "requested_by": "usr_admin_001",
  "reason": "Manual override.",
  "timestamp": "2026-06-01T21:25:31.468Z"
}
## MQTT Ingestion Flow
Device message flow:
MQTT topic + JSON payload
-> MQTT message handler
-> payload parse
-> topic router
-> payload schema validation
-> ingestion service
-> persistence mapper
-> MongoDB write
## Override Command Flow
Admin/API command flow:
POST /api/overrides
-> OverrideRequest is saved to MongoDB
-> backend builds command topic
-> backend builds command payload
-> backend publishes MQTT command if MQTT client is connected
If MQTT is disabled or not connected:
- OverrideRequest is still saved
- mqtt_publish.published is false
- mqtt_publish.reason is mqtt_not_connected
## Test Scripts
Run from backend directory.
### MQTT client skeleton
npm run test:mqtt-client
Checks:
- MQTT options
- safe env summary
- disabled-mode behavior
### MQTT message handler
npm run test:mqtt-message-handler
Checks:
- valid JSON parsing
- invalid JSON rejection
- valid heartbeat handling
- device_id mismatch rejection
### Local MQTT E2E
npm run test:mqtt-e2e-local
Checks:
- local broker starts on port 1884
- backend MQTT client subscribes
- mock messages are published
- MQTT messages are persisted to MongoDB
### Override command publisher
npm run test:mqtt-command-publisher
Checks:
- command topic builder
- command payload builder
- safe skipped publish when MQTT is not connected
### Override MQTT E2E
npm run test:override-mqtt-e2e
Checks:
- local broker starts on port 1885
- backend MQTT client starts
- createOverride creates MongoDB record
- backend publishes MQTT command
- subscriber receives command message
## Manual Local Test
Terminal 1:
cd backend
npm run mqtt:broker
Terminal 2:
cd backend
npm run mqtt:publish:mock
Expected result:
- publisher logs all published topics
- broker logs all received messages
## Current MQTT Limitations
The backend does not yet use a production MQTT broker.
Current broker options:
- local Aedes broker for development
- MQTTX manual testing
- later cloud broker or self-hosted broker on EC2
MQTT authentication is supported by environment variables but not required for local development.
## Recommended Next Steps
1. Install MQTTX.
2. Use MQTTX to connect to mqtt://localhost:1883.
3. Subscribe to home/+/command/override.
4. Publish sample heartbeat/telemetry/event/access payloads.
5. Enable MQTT in backend locally and verify live ingestion.
6. Later move MQTT broker to cloud infrastructure.

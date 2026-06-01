# Phase 1 Backend Contract Summary
## Status
Phase 1 establishes the backend-side contract and validation foundation for the Autonomous Smart Home Security project.
This phase does not connect to a real MQTT broker and does not persist data to MongoDB yet. It prepares the backend to safely receive, validate, route, and ingest structured device messages.
## Completed Items
### 1. Contract Freeze
Main contract file:
- contracts/CONTRACT_FREEZE.md
Defines:
- fixed technology stack
- user roles
- room IDs
- main device ID
- event types
- severity levels
- timestamp rule
- MQTT topics
- heartbeat policy
- notification policy
- database collections
- safety rule
### 2. Payload Examples
Payload example files:
- contracts/examples/heartbeat.json
- contracts/examples/telemetry.json
- contracts/examples/event_fire_detected.json
- contracts/examples/access_granted.json
- contracts/examples/override_request.json
- contracts/examples/override_result.json
These examples are the shared reference for firmware, backend, Android, admin web, and tests.
### 3. Backend Validation
Backend validation files:
- backend/src/validators/contract.constants.js
- backend/src/validators/payload.schemas.js
Validation is implemented using Zod.
Supported payload types:
- heartbeat
- telemetry
- event
- access
- override_request
- override_result
Validation script:
- npm run validate:contracts
### 4. Contract Validation API
Implemented endpoints:
- GET /api/contracts/types
- POST /api/contracts/validate
Purpose:
- list supported contract payload types
- validate payloads through HTTP during development
### 5. MQTT Topic Router Skeleton
MQTT helper files:
- backend/src/mqtt/mqtt.topics.js
- backend/src/mqtt/mqttPayloadRouter.js
Implemented logic:
- parse device-to-backend MQTT topics
- reject backend-to-device command topics in ingestion path
- map topic to payload type
- validate payload against schema
- reject device_id mismatch between topic and payload
Test script:
- npm run test:mqtt-router
### 6. Ingestion Service Skeleton
Service file:
- backend/src/services/ingestion.service.js
Implemented flow:
- topic + payload
- routeMqttPayload()
- validate payload
- verify topic device_id equals payload device_id
- map payload_type to ingestion action
- return accepted/rejected structured result
Test script:
- npm run test:ingestion
### 7. Mock MQTT Ingestion API
Implemented endpoint:
- POST /api/mock/mqtt
Purpose:
- test MQTT-style ingestion over HTTP before using a real MQTT broker
- support mock-first backend development
- avoid blocking on ESP32 or MQTTX during early backend work
Example accepted result includes:
- accepted: true
- source: mqtt
- payload_type: heartbeat
- device_id: esp32_home_01
- action: update_device_heartbeat
## Backend Scripts
Run from backend directory:
- npm run dev
- npm run start
- npm run validate:contracts
- npm run test:mqtt-router
- npm run test:ingestion
## Current Limitation
The backend does not yet:
- connect to MongoDB
- persist events
- connect to real MQTT broker
- receive messages from MQTTX
- receive messages from ESP32
- implement authentication
- implement RBAC
- send FCM notifications
These are planned for later phases.
## Next Phase
Phase 2 will begin platform-level backend expansion.
Recommended next implementation order:
1. MongoDB connection setup
2. Mongoose schemas for devices/events/access/overrides
3. Device heartbeat persistence
4. Offline/degraded device status calculation
5. Mock event persistence
6. Real MQTT broker connection

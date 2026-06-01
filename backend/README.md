# Backend
Node.js + Express backend for the Autonomous Smart Home Security project.
## Current Phase
The backend currently supports:
- contract validation
- MQTT-style topic parsing
- payload validation with Zod
- ingestion service skeleton
- mock MQTT ingestion over HTTP
The backend does not yet connect to MongoDB or a real MQTT broker.
## Scripts
Run these commands from the backend directory:
- npm run dev
- npm run start
- npm run validate:contracts
- npm run test:mqtt-router
- npm run test:ingestion
## Health Check
GET /health
## Contract Endpoints
GET /api/contracts/types
POST /api/contracts/validate
## Mock MQTT Endpoint
POST /api/mock/mqtt
Example body:
{
  "topic": "home/esp32_home_01/heartbeat",
  "payload": {
    "device_id": "esp32_home_01",
    "status": "online",
    "firmware_version": "0.1.0",
    "uptime_seconds": 3600,
    "wifi_rssi": -55,
    "timestamp": "2026-06-01T18:45:00Z"
  }
}
Expected accepted result includes:
- accepted: true
- source: mqtt
- payload_type: heartbeat
- device_id: esp32_home_01
- action: update_device_heartbeat
## Contract Source
Main contract:
- ../contracts/CONTRACT_FREEZE.md
Payload examples:
- ../contracts/examples/

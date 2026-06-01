# Backend API Reference
This document summarizes the backend API endpoints implemented for the Autonomous Smart Home Security project.
Base local URL:
http://localhost:5000
## Health
### GET /health
Returns backend health and database status.
Response includes:
- status
- service
- timestamp
- database.readyState
- database.status
- database.host
- database.database
## Contract Endpoints
### GET /api/contracts/types
Returns supported payload contract types.
Supported types:
- heartbeat
- telemetry
- event
- access
- override_request
- override_result
### POST /api/contracts/validate
Validates a payload against one of the supported contract schemas.
Body:
{
  "type": "heartbeat",
  "payload": {}
}
## Mock MQTT Ingestion
### POST /api/mock/mqtt
Accepts MQTT-style topic and payload over HTTP.
Body:
{
  "topic": "home/esp32_home_01/heartbeat",
  "payload": {}
}
Flow:
- validates topic
- validates payload
- checks topic device_id against payload device_id
- maps ingestion result
- persists data to MongoDB when database is connected
## Device Endpoints
### GET /api/devices
Lists devices.
Query parameters:
- status
- active
- limit
Examples:
GET /api/devices
GET /api/devices?status=online
GET /api/devices?active=true
### GET /api/devices/:deviceId
Returns a single device by device_id.
Example:
GET /api/devices/esp32_home_01
### POST /api/devices/refresh-status
Refreshes device status based on last heartbeat time.
Policy:
- 0 to 60 seconds: online
- 61 to 90 seconds: degraded
- more than 90 seconds: offline
- missing heartbeat: offline
## Event Endpoints
### GET /api/events
Lists events.
Query parameters:
- device_id
- room_id
- event_type
- severity
- confirmed
- limit
Examples:
GET /api/events
GET /api/events?severity=critical
GET /api/events?device_id=esp32_home_01
### GET /api/events/:eventId
Returns a single event by event_id.
## Access Log Endpoints
### GET /api/access-logs
Lists access logs.
Query parameters:
- device_id
- gate_id
- user_id
- access_method
- result
- limit
Examples:
GET /api/access-logs
GET /api/access-logs?result=granted
GET /api/access-logs?gate_id=main_door
### GET /api/access-logs/:accessId
Returns a single access log by access_id.
## Telemetry Endpoints
### GET /api/telemetry
Lists telemetry summaries.
Query parameters:
- device_id
- room_id
- limit
Examples:
GET /api/telemetry
GET /api/telemetry?device_id=esp32_home_01
GET /api/telemetry?room_id=kitchen
### GET /api/telemetry/latest
Returns the latest telemetry record.
Query parameters:
- device_id
- room_id
If no telemetry exists, returns 404.
## Override Endpoints
### GET /api/overrides
Lists manual override requests.
Query parameters:
- device_id
- requested_by
- action
- status
- limit
Examples:
GET /api/overrides
GET /api/overrides?status=requested
GET /api/overrides?action=buzzer_off
### GET /api/overrides/:overrideId
Returns a single override request by override_id.
### POST /api/overrides
Creates a manual override request.
Body:
{
  "device_id": "esp32_home_01",
  "requested_by": "usr_admin_001",
  "actuator_id": "buzzer_01",
  "action": "buzzer_off",
  "reason": "Manual API test override."
}
Supported actions:
- pump_on
- pump_off
- valve_open
- valve_close
- buzzer_on
- buzzer_off
- door_unlock
- system_reset
Current limitation:
- This endpoint creates the override request in MongoDB.
- Real MQTT command publishing is not implemented yet.
## Dashboard Endpoint
### GET /api/dashboard/summary
Returns dashboard summary data.
Response includes:
- generated_at
- devices.total_active
- devices.status_counts
- events.recent_critical_24h_count
- events.latest
- access_logs.latest
- telemetry.latest
- overrides.pending_count
## Current Backend Test Scripts
Run from backend directory:
npm run check:config
npm run validate:contracts
npm run test:mqtt-router
npm run test:ingestion
npm run test:models
npm run test:ingestion-mapper
npm run test:db
npm run test:persistence
npm run test:device-status
npm run test:device-api
npm run test:event-api
npm run test:access-log-api
npm run test:telemetry-api
npm run test:override-api
npm run test:dashboard-api

# Admin Web Guide
This document summarizes the admin web frontend for the Autonomous Smart Home Security project.
## Location
Frontend directory:
admin-web/
Framework:
React + Vite
## Local Development
Run from admin-web:
npm install
npm run dev
Local URL:
http://localhost:5173
## Production Build Check
Run from admin-web:
npm run build
Expected result:
Vite build completes without errors.
## Backend Requirement
The backend should be running locally:
http://localhost:5000
Backend command:
cd backend
npm run dev
## Demo Login
Demo admin credentials:
Email: admin@smarthome.local
Password: Admin123!
Before login testing, seed demo admin if needed:
cd backend
npm run seed:demo-admin
## Demo Data
Seed demo data:
cd backend
npm run seed:demo
Clean demo data:
cd backend
npm run clean:demo
## Implemented Admin Features
### Authentication
Implemented in:
admin-web/src/services/authService.js
Features:
- login
- logout
- localStorage token persistence
- stored user persistence
- authenticated app shell
### API Client
Implemented in:
admin-web/src/services/apiClient.js
Features:
- uses native fetch
- prefixes backend base URL
- attaches Authorization bearer token
- parses JSON safely
- throws useful errors for failed responses
Base URL config:
admin-web/src/config/api.js
Default backend URL:
http://localhost:5000
Optional override:
VITE_API_BASE_URL
## Connected Pages
### Dashboard
Service:
admin-web/src/services/dashboardService.js
Endpoint:
GET /api/dashboard/summary
Displays:
- active devices
- recent critical events
- pending overrides
- latest telemetry
### Devices
Service:
admin-web/src/services/deviceService.js
Endpoints:
GET /api/devices
POST /api/devices/refresh-status
Displays:
- device_id
- name
- status
- firmware_version
- last_heartbeat_at
- is_active
Features:
- device list
- refresh status button
### Events
Service:
admin-web/src/services/eventService.js
Endpoint:
GET /api/events
Displays:
- event_id
- device_id
- room_id
- event_type
- severity
- message
- confirmed
- occurred_at
Features:
- severity filter: All, info, warning, critical
### Access Logs
Service:
admin-web/src/services/accessLogService.js
Endpoint:
GET /api/access-logs
Displays:
- access_id
- device_id
- gate_id
- user_id
- access_method
- result
- occurred_at
Features:
- result filter: All, granted, denied
### Telemetry
Service:
admin-web/src/services/telemetryService.js
Endpoints:
GET /api/telemetry
GET /api/telemetry/latest
Displays:
- latest telemetry card
- device_id
- room_id
- temperature_c
- humidity_percent
- motion_detected
- flame_detected
- gas_detected
- recorded_at / createdAt
### Overrides
Service:
admin-web/src/services/overrideService.js
Endpoints:
GET /api/overrides
POST /api/overrides
Displays:
- override_id
- device_id
- requested_by
- actuator_id
- action
- reason
- status
- requested_at
- result_at
Features:
- status filter: All, requested, executed, failed, blocked
- create override form
- frontend submit to backend
- reloads list after success
## Verification Checklist
Before committing admin-web changes:
cd admin-web
npm run build
Before closing a major frontend phase:
cd backend
npm run test:backend
Expected backend result:
All backend regression checks passed.
## Current Notes
The UI is functional but not final-polished yet.
Known visual polish items for later:
- improve table responsiveness
- reduce horizontal scroll
- improve cards and spacing
- refine typography and colors
- improve telemetry display
- make dashboard more presentation-ready
Final UI polish should be done after all functional frontend pages are complete.

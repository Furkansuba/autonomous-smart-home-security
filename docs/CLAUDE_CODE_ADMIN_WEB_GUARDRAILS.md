# Claude Code Admin Web Guardrails
This document defines strict working rules for Claude Code while building the admin web frontend.
## Project Context
Project name:
Autonomous Smart Home Security
Current backend status:
- Backend is already implemented.
- MongoDB Atlas persistence works.
- MQTT ingestion works.
- MQTT override command publishing works.
- JWT authentication works.
- RBAC works.
- Request validation works.
- Centralized error handling works.
- Backend regression runner exists.
Main backend verification command:
cd backend
npm run test:backend
Expected result:
All backend regression checks passed.
## Claude Code Working Scope
Claude Code may work inside:
- admin-web/
Claude Code may read:
- docs/
- contracts/
- backend/package.json
- backend/src/routes/
- backend/src/controllers/
- backend/src/models/
Claude Code must not edit backend files unless explicitly instructed.
Forbidden edit paths:
- backend/src/
- backend/scripts/
- backend/package.json
- backend/package-lock.json
- contracts/
- docs/CONTRACT_FREEZE.md
## Admin Web Goal
Build a React/Vite admin dashboard that consumes the existing backend API.
Frontend should support:
- login with JWT
- authenticated API client
- dashboard summary page
- devices page
- events page
- access logs page
- telemetry page
- overrides page
- create override form
- logout
## Required Backend API References
Use these docs before coding:
- docs/BACKEND_API_REFERENCE.md
- docs/AUTH_RBAC_GUIDE.md
- docs/BACKEND_TEST_GUIDE.md
- docs/MQTT_INTEGRATION_GUIDE.md
- docs/PHASE_4_BACKEND_HARDENING_SUMMARY.md
## Backend Base URL
Local backend:
http://localhost:5000
Vite dev frontend:
http://localhost:5173
## Authentication
Login endpoint:
POST /api/auth/login
Demo admin:
Email: admin@smarthome.local
Password: Admin123!
Authenticated requests must use:
Authorization: Bearer TOKEN
## Protected Routes
Currently protected by admin RBAC:
- POST /api/overrides
- POST /api/devices/refresh-status
Frontend must send JWT token for these operations.
## Frontend Rules
Use plain React first.
Allowed:
- React hooks
- CSS modules or plain CSS
- fetch API
- localStorage for demo JWT persistence
- simple route state if React Router is not installed yet
Do not add unnecessary libraries unless asked.
Do not install UI frameworks yet unless explicitly instructed.
Do not redesign project architecture aggressively.
Keep changes small and reviewable.
## Required Quality Checks
After each frontend task, run from admin-web:
npm run build
If backend files were touched accidentally, stop and report.
Before final commit, run from project root:
git status
Expected:
- only intended admin-web files changed
## First Claude Code Task
Implement only the admin-web frontend baseline cleanup:
1. Replace default Vite page.
2. Create a clean dashboard shell layout.
3. Add placeholder navigation for:
   - Dashboard
   - Devices
   - Events
   - Access Logs
   - Telemetry
   - Overrides
4. Add basic CSS.
5. Do not call backend yet.
6. Do not add authentication yet.
7. Do not edit backend.
Success criteria:
- npm run build passes in admin-web
- frontend displays Smart Home Security Admin shell
- backend files are untouched

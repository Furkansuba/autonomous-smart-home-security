# Authentication and RBAC Guide
This document summarizes the authentication and role-based access control foundation of the Autonomous Smart Home Security backend.
## Status
The backend now supports:
- User model
- password hashing with bcryptjs
- JWT token generation
- JWT token verification
- authenticated user lookup
- role-based authorization middleware
- demo admin seed
- protected critical API routes
## Demo Admin User
Demo admin seed command:
cd backend
npm run seed:demo-admin
Demo credentials:
Email: admin@smarthome.local
Password: Admin123!
Role: admin
These credentials are for local development and demo usage only.
## Auth Endpoints
Base URL:
http://localhost:5000
### POST /api/auth/login
Purpose:
Authenticates a user with email and password.
Request body:
{
  "email": "admin@smarthome.local",
  "password": "Admin123!"
}
Successful response includes:
- authenticated: true
- token
- token_type: Bearer
- expires_in
- user
Example response shape:
{
  "authenticated": true,
  "token": "...",
  "token_type": "Bearer",
  "expires_in": "1d",
  "user": {
    "user_id": "usr_admin_001",
    "email": "admin@smarthome.local",
    "full_name": "Demo Admin",
    "role": "admin",
    "is_active": true
  }
}
### GET /api/auth/me
Purpose:
Returns the current authenticated user.
Required header:
Authorization: Bearer TOKEN_HERE
Successful response includes:
{
  "authenticated": true,
  "user": {
    "user_id": "usr_admin_001",
    "email": "admin@smarthome.local",
    "full_name": "Demo Admin",
    "role": "admin",
    "is_active": true
  }
}
## User Roles
Supported roles:
- admin
- resident
- guest
Current RBAC policy:
- admin can access protected critical write/command endpoints
- resident and guest are authenticated roles but cannot access admin-only routes
## Protected Routes
The following routes are currently protected by authentication and admin RBAC:
### POST /api/overrides
Purpose:
Creates manual override request and attempts MQTT command publishing.
Required:
Authorization: Bearer admin_token
Tokensız request sonucu:
{
  "error": "Missing bearer token."
}
Admin token ile başarılı sonuç:
{
  "created": true,
  "override": {},
  "mqtt_publish": {}
}
### POST /api/devices/refresh-status
Purpose:
Refreshes device statuses based on heartbeat timeout policy.
Required:
Authorization: Bearer admin_token
## Public Routes For Now
The following routes are intentionally still public during development:
- GET /health
- GET /api/devices
- GET /api/devices/:deviceId
- GET /api/events
- GET /api/events/:eventId
- GET /api/access-logs
- GET /api/access-logs/:accessId
- GET /api/telemetry
- GET /api/telemetry/latest
- GET /api/overrides
- GET /api/overrides/:overrideId
- GET /api/dashboard/summary
- GET /api/contracts/types
- POST /api/contracts/validate
- POST /api/mock/mqtt
These can be protected later when admin web and Android clients are ready.
## Manual Login Test
Start backend:
cd backend
npm run dev
Then run:
$body = @{
  email = "admin@smarthome.local"
  password = "Admin123!"
} | ConvertTo-Json -Depth 10
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5000/api/auth/login" `
  -ContentType "application/json" `
  -Body $body
$login | ConvertTo-Json -Depth 10
$headers = @{
  Authorization = "Bearer " + $login.token
}
Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:5000/api/auth/me" `
  -Headers $headers
## Manual RBAC Test
Tokensız override request:
$body = @{
  device_id = "esp32_home_01"
  requested_by = "usr_admin_001"
  actuator_id = "buzzer_01"
  action = "buzzer_off"
  reason = "RBAC manual no-token test."
} | ConvertTo-Json -Depth 10
try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:5000/api/overrides" `
    -ContentType "application/json" `
    -Body $body
} catch {
  $_.ErrorDetails.Message
}
Expected result:
{
  "error": "Missing bearer token."
}
Admin token ile override request:
$response = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5000/api/overrides" `
  -ContentType "application/json" `
  -Headers $headers `
  -Body $body
$response | ConvertTo-Json -Depth 10
Expected result:
{
  "created": true
}
## Test Scripts
Run from backend directory:
npm run test:auth-api
npm run test:rbac
npm run test:models
npm run test:device-api
npm run test:override-api
## Security Notes
JWT_SECRET must be changed before production use.
Current local warning:
[AUTH] JWT_SECRET should be changed before production use.
This is acceptable during local development, but production deployment must use a strong secret stored in environment variables.
Demo password must not be reused in production.

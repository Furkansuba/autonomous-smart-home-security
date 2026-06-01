# CLAUDE.md — Autonomous Smart Home Security
## Project Summary
This repository is for a capstone project named Autonomous Smart Home Security.
The system is not only a mobile application. It is a full IoT software system connecting:
- ESP32 embedded device
- MQTT event and heartbeat messaging
- Node.js + Express backend
- MongoDB Atlas persistence
- JWT + RBAC authentication and authorization
- Kotlin Android resident app
- React admin dashboard
- Firebase Cloud Messaging
- AWS EC2 deployment
## Source of Truth
The primary project contract is:
- contracts/CONTRACT_FREEZE.md
Always read this file before changing backend, Android, admin-web, firmware, or test logic.
Do not invent new event names, MQTT topics, database collections, roles, device status values, or severity values unless the contract file is updated first.
## Fixed Technical Decisions
Use:
- Backend: Node.js + Express
- Database: MongoDB Atlas with Mongoose
- Authentication: JWT
- Authorization: RBAC
- MQTT: MQTT.js on backend, Mosquitto-compatible broker
- Mobile: Kotlin Android
- Android UI: Jetpack Compose
- Android architecture: MVVM + Repository pattern
- Web: React
- Notifications: Firebase Cloud Messaging
- Deployment target: AWS EC2
- Main device ID: esp32_home_01
## Development Strategy
Follow this order:
1. Contract freeze
2. Platform skeleton
3. Mock-first end-to-end flow
4. Heartbeat and offline detection
5. Real sensor event pipeline
6. NFC access control and audit logs
7. Manual override
8. Android and React UI completion
9. Notification policy
10. Evaluation, testing, and demo hardening
Never skip directly to UI polish before backend contracts and mock end-to-end flow work.
## Safety-Critical Rules
Safety overrides security.
If fire is detected:
- activate pump
- open the related room valve
- trigger alarm
- publish critical event
If gas or CO is detected:
- trigger alarm
- lock out pump
- never activate pump, even through manual override
- publish critical event
Gas/CO pump lockout is mandatory and must not be bypassed.
## Agent Behavior Rules
When modifying code:
- prefer small, reviewable changes
- explain which files changed and why
- do not rewrite unrelated files
- do not change contract values silently
- do not introduce secrets into the repository
- use .env.example for environment variables
- keep implementation aligned with contracts/CONTRACT_FREEZE.md
- preserve monorepo folder boundaries
- create mock-first tests before relying on real hardware
## Git Rules
Before commit:
- run relevant build or test commands when available
- check git status
- summarize changed files
Commit messages should be concise and descriptive.
## Backend Rules
Backend must:
- validate all incoming MQTT payloads
- reject unknown event types
- store immutable event logs
- enforce JWT on protected REST endpoints
- enforce RBAC on admin-only actions
- never trust client-provided role data
- calculate offline/degraded status from heartbeat timestamps
- log override requests and results
## Android Rules
Android must:
- use Kotlin
- use Jetpack Compose
- use MVVM
- use Repository pattern
- keep UI state observable
- avoid hardcoded backend URLs outside config/build settings
- show online/degraded/offline clearly
- route notification taps to relevant alert or event detail screens
## Admin Web Rules
Admin panel must:
- restrict admin-only pages
- show device status clearly
- show event logs
- show access logs
- show override logs
- keep reports simple and readable
## Testing Rules
Required scenarios:
- fire event
- gas event
- CO event
- intrusion event
- heartbeat loss
- reconnect recovery
- NFC access granted
- NFC access denied
- manual override success
- manual override blocked because gas/CO is active
- unauthorized admin action
- push notification delivery
## Current Phase
Current phase: Phase 0 / Phase 1.
Do not generate full backend, Android, web, or firmware implementation until the user explicitly asks to enter the next phase.

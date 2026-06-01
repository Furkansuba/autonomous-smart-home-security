# Backend Test Guide
This document summarizes the backend test and verification workflow for the Autonomous Smart Home Security project.
## Main Regression Command
Run from backend directory:
npm run test:backend
This command runs the full backend regression suite.
It includes:
- environment and config checks
- contract validation
- pagination helper tests
- request validation tests
- centralized error handler tests
- Mongoose model tests
- auth API tests
- RBAC middleware tests
- MQTT client tests
- MQTT message handler tests
- MQTT command publisher tests
- MQTT router tests
- ingestion service tests
- persistence mapper tests
- MongoDB connection test
- persistence service test
- device status service test
- REST API controller tests
- MQTT local E2E test
- override MQTT publish E2E test
Expected final output:
All backend regression checks passed.
## Full Regression Script
File:
backend/scripts/run-backend-checks.js
Package script:
test:backend = node scripts/run-backend-checks.js
## Individual Test Commands
Run from backend directory.
## Config and Contracts
npm run check:config
npm run validate:contracts
## Core API Helpers
npm run test:pagination
npm run test:request-validation
npm run test:error-handlers
## Models, Auth, and RBAC
npm run test:models
npm run test:auth-api
npm run test:rbac
## MQTT
npm run test:mqtt-client
npm run test:mqtt-message-handler
npm run test:mqtt-command-publisher
npm run test:mqtt-router
npm run test:mqtt-e2e-local
npm run test:override-mqtt-e2e
## Ingestion and Persistence
npm run test:ingestion
npm run test:ingestion-mapper
npm run test:db
npm run test:persistence
## REST API Controllers
npm run test:device-status
npm run test:device-api
npm run test:event-api
npm run test:access-log-api
npm run test:telemetry-api
npm run test:override-api
npm run test:dashboard-api
## Demo Data
Seed demo data:
npm run seed:demo
Clean demo data:
npm run clean:demo
Seed demo admin:
npm run seed:demo-admin
Demo admin credentials:
Email: admin@smarthome.local
Password: Admin123!
Role: admin
## Manual Development Workflow
Recommended local development order:
npm install
npm run check:config
npm run test:backend
npm run seed:demo
npm run seed:demo-admin
npm run dev
## Manual MQTT Workflow
Terminal 1:
npm run mqtt:broker
Terminal 2:
npm run mqtt:publish:mock
For MQTTX manual command test:
1. Start local broker.
2. Start backend with MQTT_ENABLED=true.
3. Connect MQTTX to mqtt://localhost:1883.
4. Subscribe to home/+/command/override.
5. Send authenticated POST /api/overrides.
6. Verify MQTTX receives the override command payload.
## What Must Pass Before Commit
Before backend code commits, run:
npm run test:backend
For documentation-only commits, this may be skipped if no backend code changed.
## Current Known Local Warnings
During auth tests, this warning may appear:
[AUTH] JWT_SECRET should be changed before production use.
This is expected in local development when using a demo secret.
Before production deployment:
- JWT_SECRET must be replaced with a strong secret.
- Demo credentials must be removed or changed.
- MongoDB credentials must remain outside Git.
- .env must not be committed.

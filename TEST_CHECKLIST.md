# Test Checklist — Autonomous Smart Home Security

Capstone Phase 7 evaluation checklist. Each item must be executed and recorded during the demo or evaluation session.

## Legend

```
- [ ]  not yet tested
- [x]  passed
- [~]  partial / inconclusive
- [!]  failed
```

---

## 1. Backend Regression

Run from the `backend/` directory.

```bash
npm run test:backend
```

- [ ] All backend regression checks pass
  - Expected final output: `All backend regression checks passed.`
  - Covers: config, contracts, request validation, error handling, auth, RBAC, MQTT router, ingestion, persistence, all REST controllers, dashboard, MQTT E2E

---

## 2. Authentication and RBAC

**Setup:** Backend running, `seed:demo-admin` and `seed:demo-resident` executed.

### Login — valid credentials
- [ ] `POST /api/auth/login` with `admin@smarthome.local` / `Admin123!` returns `authenticated: true` and a JWT token
- [ ] `POST /api/auth/login` with `resident@smarthome.local` / `Resident123!` returns `authenticated: true` and a JWT token

### Login — invalid credentials
- [ ] `POST /api/auth/login` with wrong password returns 401 and `authenticated: false`

### JWT verification
- [ ] `GET /api/auth/me` with valid admin token returns `role: admin`
- [ ] `GET /api/auth/me` with valid resident token returns `role: resident`
- [ ] `GET /api/auth/me` with no token returns 401

### RBAC — admin-only write routes
- [ ] `POST /api/overrides` with **no token** returns `"Missing bearer token."`
- [ ] `POST /api/overrides` with **resident token** returns 403
- [ ] `POST /api/overrides` with **admin token** returns `created: true`
- [ ] `POST /api/devices/refresh-status` with **no token** returns 401
- [ ] `POST /api/devices/refresh-status` with **admin token** succeeds

---

## 3. Safety Logic — Gas/CO Pump Lockout

**Context:** The capstone proposal (§1.3, §8) mandates that a `pump_on` override must be blocked while a gas or CO event is active. This is a safety-critical requirement. The rule is enforced in `backend/src/controllers/overrides.controller.js`: when `pump_on` is requested and a `gas_detected` or `co_detected` event exists for the same device within the last 24 hours, the override is saved with `status: blocked` and the MQTT command is not published.

**Note:** Firmware-level enforcement on the ESP32 is MCH scope and is not in this repo.

### Live enforcement (backend code)

- [ ] `POST /api/overrides` with `action: pump_on` while a `gas_detected` or `co_detected` event is active returns `201` with `created: true` and `blocked: true`
- [ ] Response `override.status` is `"blocked"`
- [ ] Response `override.blocked_reason` is non-empty and describes the gas/CO lockout
- [ ] Response `mqtt_publish.published` is `false` — no MQTT command is sent to the device
- [ ] `npm run test:override-api` passes including the gas/CO lockout test case

### Seeded demo records (UI verification)

- [ ] `GET /api/overrides` includes the seeded record with `action: pump_on` and `status: blocked`
- [ ] The blocked override record is visible in the Android Overrides screen
- [ ] The blocked override record is visible in the admin-web Overrides page
- [ ] The `blocked_reason` field of the seeded override correctly describes the gas/CO lockout

---

## 4. Safety Logic — Fire Response

**Context:** `fire_detected` events must be stored with `severity: critical`. Automatic pump and valve activation is firmware/hardware scope; the software pipeline stores and surfaces the event.

- [ ] `GET /api/events` includes a `fire_detected` event with `severity: critical`
- [ ] Fire event has correct `room_id` (`kitchen`) and `device_id` fields
- [ ] Fire event is visible in the Android Alerts tab with critical color coding
- [ ] Fire event is visible in the admin-web Events page with the critical severity badge

---

## 5. Heartbeat and Offline Detection

**Setup:** `seed:demo` executed. Three devices are seeded with different `last_heartbeat_at` values to produce online / degraded / offline states.

- [ ] `GET /api/devices` shows `esp32_demo_home_01` with `status: online`
- [ ] `GET /api/devices` shows `esp32_demo_garage_01` with `status: degraded`
- [ ] `GET /api/devices` shows `esp32_demo_entry_01` with `status: offline`
- [ ] `POST /api/devices/refresh-status` (admin token) recalculates statuses without error
- [ ] Android Devices tab shows all three status badges correctly
- [ ] Admin-web Devices page shows all three status badges correctly

---

## 6. Event Pipeline

**All events verified via `GET /api/events` or UI display.**

### Safety events (must be critical)
- [ ] `fire_detected` event present — `severity: critical`
- [ ] `gas_detected` event present — `severity: critical`
- [ ] `intrusion_detected` event present — `severity: critical`

### Security events
- [ ] `motion_detected` (garage) present — `severity: warning`
- [ ] `motion_detected` (entry area) present — `severity: info`

### Data integrity
- [ ] Every event has a non-empty `event_id`, `device_id`, `room_id`, `occurred_at`
- [ ] No fire or gas event has a severity other than `critical`
- [ ] All events appear in the Android Alerts tab
- [ ] All events appear in the admin-web Events page

---

## 7. NFC Access Logs

- [ ] `GET /api/access-logs` returns seeded NFC access records
- [ ] At least one record with `result: granted` is present
- [ ] At least one record with `result: denied` is present
- [ ] Admin-web Access Logs page loads all records
- [ ] Outcome filter (All / granted / denied) correctly re-fetches
- [ ] Denial rate card shows a non-zero value and color-codes correctly

---

## 8. Manual Override

**Admin token required for write operations.**

### Data verification
- [ ] `GET /api/overrides` returns four seeded records
- [ ] Status distribution: one `requested`, one `executed`, one `failed`, one `blocked`
- [ ] All four records are visible in the admin-web Overrides page
- [ ] All four records are visible in the Android Overrides screen

### Admin-web override submission
- [ ] Issue Command Override form is visible when logged in as admin
- [ ] Quick Action preset "Buzzer Off" populates the form fields
- [ ] Submitting the form creates a new override record
- [ ] Newly submitted record appears in the history table after submission

### Android Silence Alarm
- [ ] Silence Alarm card is visible on the Overrides screen when logged in as admin
- [ ] Tapping Silence Alarm shows a confirmation dialog
- [ ] Confirming sends a `buzzer_off` command to `esp32_home_01`
- [ ] New override record appears in the history list

---

## 9. Android App

### Login
- [ ] Login with `admin@smarthome.local` / `Admin123!` succeeds and navigates to Dashboard
- [ ] Login with `resident@smarthome.local` / `Resident123!` succeeds and navigates to Dashboard
- [ ] Login with wrong credentials shows an inline error message
- [ ] Login does not crash or hang

### Biometric unlock (stored-session unlock)
- [ ] After a password login, force-close the app and relaunch
- [ ] Biometric prompt appears automatically (requires enrolled fingerprint on device)
- [ ] Successful biometric scan navigates to Dashboard without re-entering password
- [ ] Tapping "Use password" dismisses the prompt and shows the credential form
- [ ] Biometric prompt does **not** appear on a fresh install (no stored session)

### Dashboard — admin account
- [ ] Dashboard loads without error
- [ ] Device summary cards are populated
- [ ] Recent critical events section is populated

### Devices tab
- [ ] Three seeded devices are listed
- [ ] Status badges show online / degraded / offline

### Alerts tab
- [ ] Fire, gas, intrusion, and motion events are listed
- [ ] Critical events have distinct color coding from warning/info

### Sensors tab
- [ ] Latest telemetry readings are shown per room
- [ ] Temperature, humidity, gas raw, CO raw, motion, flame, reed state are present

### Override History — admin account
- [ ] Overrides screen is accessible from the Dashboard
- [ ] Four seeded overrides are visible
- [ ] Silence Alarm card is rendered
- [ ] Silence Alarm confirmation dialog functions correctly
- [ ] `buzzer_off` command is submitted and new record appears

### RBAC — resident account
- [ ] Log out and log in as `resident@smarthome.local`
- [ ] Dashboard, Devices, Alerts, Sensors tabs are all accessible
- [ ] Overrides screen is accessible
- [ ] Override history is visible (read-only)
- [ ] Silence Alarm card is **not rendered**

---

## 10. Admin Web

### Login
- [ ] Login page loads at `http://localhost:5173`
- [ ] Login with admin credentials succeeds
- [ ] Invalid credentials show an inline error (no crash, no blank page)
- [ ] Logout clears the session and returns to the login page

### Dashboard — admin account
- [ ] Security status banner renders (Low / Elevated / High Risk)
- [ ] KPI cards: Active Devices, Critical Events, Pending Overrides, Latest Telemetry
- [ ] Latest Sensor Snapshot tiles render
- [ ] Risk assessment panel renders

### Devices page
- [ ] Device table loads with three seeded devices
- [ ] Status badges render correctly
- [ ] Refresh Status button completes without error

### Events page
- [ ] Events table loads
- [ ] Severity filter (All / info / warning / critical) re-fetches correctly
- [ ] Top Incident panel populates with the highest-severity event

### Access Logs page
- [ ] Access logs table loads
- [ ] Outcome filter (All / granted / denied) works
- [ ] Denial rate card is visible

### Telemetry page
- [ ] Featured Latest Reading panel loads
- [ ] Sensor tile grid renders
- [ ] All Records table shows historical entries

### Overrides page — admin account
- [ ] Override history table loads
- [ ] Status filter re-fetches correctly
- [ ] Issue Command Override form is visible
- [ ] Quick Action presets (Buzzer Off, Buzzer On, Door Unlock) populate the form
- [ ] Submitting a command creates a new record

### UI shell
- [ ] Light / dark theme toggle switches and persists across reload
- [ ] Profile page shows email, role, and user ID
- [ ] Sidebar navigation switches pages without full reload

### RBAC — resident account
- [ ] Log out and log in as `resident@smarthome.local`
- [ ] Overrides page shows history (read-only)
- [ ] Override command form is replaced with the "Admin Role Required" locked panel
- [ ] No override command can be submitted

---

## 11. Push Notifications / FCM

**Status: FCM is not yet implemented in this repository.**

Firebase Cloud Messaging is listed as a capstone requirement but is not currently present in the Android project (`android/app/build.gradle.kts` has no Firebase dependencies and no `google-services.json`). The items below are listed for evaluation transparency and cannot be verified until FCM is integrated.

- [ ] FCM dependency added to `android/app/build.gradle.kts`
- [ ] `google-services.json` present in `android/app/`
- [ ] Backend sends FCM notification on `fire_detected` event
- [ ] Backend sends FCM notification on `gas_detected` event
- [ ] Backend sends FCM notification on `co_detected` event
- [ ] Backend sends FCM notification on `device_offline` state change
- [ ] Android device receives push notification within ≤ 10 seconds of event

---

## 12. MQTT Live Pipeline

**Setup:** Local broker running (`npm run mqtt:broker`), backend started with `MQTT_ENABLED=true`, `seed:demo-admin` executed, Android app and admin-web open.

```bash
# Terminal 1
cd backend && npm run mqtt:broker

# .env: set MQTT_ENABLED=true, restart backend
# Terminal 2
cd backend && npm start

# Terminal 3 — run after /health confirms mqtt.connected: true
cd backend && npm run mqtt:publish:mock
```

### 12.1 Backend health and connection

- [ ] `GET /health` returns `"mqtt": { "enabled": true, "connected": true }`
- [ ] Backend Terminal 2 prints `[MQTT] handled home/esp32_home_01/heartbeat as heartbeat for esp32_home_01`
- [ ] Backend Terminal 2 prints `[MQTT] handled home/esp32_home_01/telemetry as telemetry for esp32_home_01`
- [ ] Backend Terminal 2 prints `[MQTT] handled home/esp32_home_01/event as event for esp32_home_01`
- [ ] Backend Terminal 2 prints `[MQTT] handled home/esp32_home_01/access as access for esp32_home_01`
- [ ] Backend Terminal 2 prints `[MQTT] handled home/esp32_home_01/override/result as override_result for esp32_home_01`

### 12.2 Persistence — REST verification

- [ ] `GET /api/devices` shows `esp32_home_01` with `status: online` and a recent `last_heartbeat_at`
- [ ] `GET /api/telemetry` includes a new kitchen entry with a current timestamp (not `2026-06-01`)
- [ ] `GET /api/events` includes a new `fire_detected` event with `severity: critical` and a current timestamp
- [ ] `GET /api/access-logs` includes a new `granted` NFC entry with a current timestamp
- [ ] `GET /api/overrides` includes a record with `status: executed` created by the publisher run

### 12.3 UI visibility

- [ ] New `fire_detected` event appears in the Android Alerts tab with current timestamp and critical color
- [ ] New `fire_detected` event appears in the admin-web Events page
- [ ] New kitchen telemetry reading appears in the admin-web Telemetry page All Records table
- [ ] New `granted` access log entry appears in the admin-web Access Logs page
- [ ] Publisher-created override with `status: executed` appears in the admin-web Overrides page
- [ ] Publisher-created override with `status: executed` appears in the Android Overrides screen

### 12.4 Repeat-run safety

- [ ] Running `npm run mqtt:publish:mock` a second time completes without errors
- [ ] Second run produces a new event with a different `event_id` and current timestamp
- [ ] No duplicate key errors appear in backend Terminal 2
- [ ] Second run creates a second `executed` override record (not a conflict with the first)

---

## 13. Known Gaps for Evaluator Reference

These items are part of the capstone proposal but are outside the scope of the software repository in its current state. They are recorded here so the evaluation panel can account for them.

| Item | Status | Owner |
|---|---|---|
| ESP32 firmware | Not implemented — `firmware/` is empty | MCH team |
| Physical home model and sensor wiring | Hardware scope | MCH team |
| Real sensor events via live MQTT | Runnable locally via `npm run mqtt:broker` + `npm run mqtt:publish:mock` (see Section 12). Live hardware events require ESP32 firmware — MCH scope. | Both teams |
| AWS EC2 deployment | Not deployed — backend runs locally on `localhost:5000` | CMP / infra |
| Firebase Cloud Messaging (FCM) | Not implemented in Android | CMP |
| SMS connectivity-loss notifications | Not implemented anywhere | CMP |
| NFC hardware trigger → access log pipeline | Access logs seeded and visible; RC522 hardware integration is firmware scope | MCH team |
| Automatic fire suppression (pump + valve) | Requires firmware; software override path is implemented | MCH + CMP |

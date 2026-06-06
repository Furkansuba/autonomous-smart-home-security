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

- [x] All backend regression checks pass
  - Expected final output: `All backend regression checks passed.`
  - Covers: config, contracts, request validation, error handling, auth, RBAC, MQTT router, ingestion, persistence, all REST controllers, dashboard, MQTT E2E
  - **Verified:** 26/26 checks pass, including 5 new override auto-ack test cases (disabled stays requested, enabled becomes executed, hazard-active alarm silence, excluded action stays requested, already-resolved no-op).

---

## 2. Authentication and RBAC

**Setup:** Backend running, `seed:demo-admin` and `seed:demo-resident` executed.

### Login — valid credentials
- [x] `POST /api/auth/login` with `admin@smarthome.local` / `Admin123!` returns `authenticated: true` and a JWT token
- [x] `POST /api/auth/login` with `resident@smarthome.local` / `Resident123!` returns `authenticated: true` and a JWT token

### Login — invalid credentials
- [x] `POST /api/auth/login` with wrong password returns 401 and `authenticated: false`

### JWT verification
- [x] `GET /api/auth/me` with valid admin token returns `role: admin`
- [x] `GET /api/auth/me` with valid resident token returns `role: resident`
- [x] `GET /api/auth/me` with no token returns 401

### RBAC — admin-only write routes
- [x] `POST /api/overrides` with **no token** returns `"Missing bearer token."` (401)
- [x] `POST /api/overrides` with **resident token** returns 403
- [x] `POST /api/overrides` with **admin token** returns `created: true`
- [x] `POST /api/devices/refresh-status` with **no token** returns 401
- [x] `POST /api/devices/refresh-status` with **admin token** succeeds
- **Verified:** All 13 live RBAC API test cases passed on EC2. Open-read endpoints (GET /api/events, GET /api/devices, GET /api/overrides) are intentional design — no auth required to read.

---

## 3. Safety Logic — Gas/CO Pump Lockout

**Context:** The capstone proposal (§1.3, §8) mandates that a `pump_on` override must be blocked while a gas or CO event is active. This is a safety-critical requirement. The rule is enforced in `backend/src/controllers/overrides.controller.js`: when `pump_on` is requested and a `gas_detected` or `co_detected` event exists for the same device within the last 24 hours, the override is saved with `status: blocked` and the MQTT command is not published.

**Note:** Firmware-level enforcement on the ESP32 is MCH scope and is not in this repo.

### Live enforcement (backend code)

- [x] `POST /api/overrides` with `action: pump_on` while a `gas_detected` or `co_detected` event is active returns `201` with `created: true` and `blocked: true`
- [x] Response `override.status` is `"blocked"`
- [x] Response `override.blocked_reason` is non-empty and describes the gas/CO lockout
- [x] Response `mqtt_publish.published` is `false` — no MQTT command is sent to the device
- [x] `npm run test:override-api` passes including the gas/CO lockout test case
- **Verified on EC2:** override_id `ovr_1780705860816_18025`, status=blocked, mqtt_publish.published=false.

### Seeded demo records (UI verification)

- [x] `GET /api/overrides` includes the seeded record with `action: pump_on` and `status: blocked`
- [x] The blocked override record is visible in the Android Overrides screen
- [x] The blocked override record is visible in the admin-web Overrides page
- [x] The `blocked_reason` field of the seeded override correctly describes the gas/CO lockout

---

## 4. Safety Logic — Fire Response

**Context:** `fire_detected` events must be stored with `severity: critical`. Automatic pump and valve activation is firmware/hardware scope; the software pipeline stores and surfaces the event.

- [x] `GET /api/events` includes a `fire_detected` event with `severity: critical`
- [x] Fire event has correct `room_id` (`kitchen`) and `device_id` fields
- [x] Fire event is visible in the Android Alerts tab with critical color coding
- [x] Fire event is visible in the admin-web Events page with the critical severity badge

**Verification scope:** `fire_detected` event verified via mock MQTT (`POST /api/mock/mqtt`) and seeded data. Real flame sensor trigger, physical pump activation, and physical valve actuator response NOT tested — requires ESP32 firmware (MCH scope).

---

## 5. Heartbeat and Offline Detection

**Setup:** `seed:demo` executed. Three devices are seeded with different `last_heartbeat_at` values to produce online / degraded / offline states.

- [x] `GET /api/devices` shows `esp32_demo_home_01` with `status: online`
- [x] `GET /api/devices` shows `esp32_demo_garage_01` with `status: degraded`
- [x] `GET /api/devices` shows `esp32_demo_entry_01` with `status: offline`
- [x] `POST /api/devices/refresh-status` (admin token) recalculates statuses without error
- [x] Android Devices tab shows all three status badges correctly
- [x] Admin-web Devices page shows all three status badges correctly

**Verification scope:** Status badges verified from seeded `last_heartbeat_at` timestamps in the Device collection. Backend offline monitor (`degraded→offline` transition) verified via controlled EC2 test — see §14.5. Real ESP32 heartbeat hardware (live MQTT heartbeat messages from device) NOT tested.

---

## 6. Event Pipeline

**All events below are present via seeded data or mock MQTT events (`POST /api/mock/mqtt`). Real hardware sensors (PIR, flame detector, gas sensor, reed switch) NOT tested — requires ESP32 firmware (MCH scope).**

### Safety events (must be critical)
- [x] `fire_detected` event present — `severity: critical`
- [x] `gas_detected` event present — `severity: critical`
- [x] `intrusion_detected` event present — `severity: critical`

### Security events
- [x] `motion_detected` (garage) present — `severity: warning`
- [x] `motion_detected` (entry area) present — `severity: info`

### Data integrity
- [x] Every event has a non-empty `event_id`, `device_id`, `room_id`, `occurred_at`
- [x] No fire or gas event has a severity other than `critical`
- [x] All events appear in the Android Alerts tab
- [x] All events appear in the admin-web Events page

---

## 7. NFC Access Logs

**Note:** All records below are seeded data. Real RC522 NFC card scan and physical door unlock NOT tested — live NFC integration requires ESP32 firmware (MCH scope). Page load, outcome filtering, and denial rate card verified against seeded records only.

- [x] `GET /api/access-logs` returns seeded NFC access records
- [x] At least one record with `result: granted` is present
- [x] At least one record with `result: denied` is present
- [x] Admin-web Access Logs page loads all records
- [x] Outcome filter (All / granted / denied) correctly re-fetches
- [x] Denial rate card shows a non-zero value and color-codes correctly

---

## 8. Manual Override

**Admin token required for write operations.**

### Data verification
- [x] `GET /api/overrides` returns four seeded records
- [x] Status distribution: one `requested`, one `executed`, one `failed`, one `blocked`
- [x] All four records are visible in the admin-web Overrides page
- [x] All four records are visible in the Android Overrides screen

### Admin-web override submission
- [x] Issue Command Override form is visible when logged in as admin
- [x] Quick Action presets (Silence Alarm, Test Buzzer, Stop Pump, Close Valve) populate the form fields
- [x] Action dropdown groups Safe and Advanced actions with clear optgroup labels
- [x] Submitting each safe quick action creates a new override record
- [x] Records appear with `status: executed` after ~500 ms (OVERRIDE_DEMO_AUTO_ACK=true on EC2)
- [x] Door Unlock is in the Advanced dropdown only — stays `requested` without real ESP32

### Android Safe Override Actions
- [x] Admin Actions card is visible on the Overrides screen when logged in as admin (2×2 grid)
- [x] Each button shows a confirmation dialog with action name and hazard-not-resolved notice
- [x] All four safe actions (buzzer_off, buzzer_on, pump_off, valve_close) submitted and executed
- [x] New override records appear in history with `status: executed`
- [x] Hazard events (fire/gas/CO/intrusion) remained visible after alarm silence — not cleared

### Override auto-ack verification (EC2)
- [x] `OVERRIDE_DEMO_AUTO_ACK=true`, `OVERRIDE_DEMO_AUTO_ACK_DELAY_MS=500` confirmed active (env count 16→18 at startup)
- [x] `[AUTO_ACK] ... → executed (demo-simulated, no real hardware)` appears in PM2 logs
- [x] `[AUTO_ACK] ... alarm silenced — SAFETY HAZARD STILL ACTIVE` logged when hazard is active
- [x] No FCM notification triggered by override auto-ack
- [x] Hazard events unchanged after auto-ack

---

## 9. Android App

### Login
- [x] Login with `admin@smarthome.local` / `Admin123!` succeeds and navigates to Dashboard
- [x] Login with `resident@smarthome.local` / `Resident123!` succeeds and navigates to Dashboard
- [x] Login with wrong credentials shows an inline error message
- [x] Login does not crash or hang

### Biometric unlock (stored-session unlock)
- [x] After a password login, force-close the app and relaunch
- [x] Biometric prompt appears automatically (requires enrolled fingerprint on device)
- [x] Successful biometric scan navigates to Dashboard without re-entering password
- [x] Tapping "Use password" dismisses the prompt and shows the credential form
- [x] Biometric prompt does **not** appear on a fresh install (no stored session)

### Dashboard — admin account
- [x] Dashboard loads without error
- [x] Device summary cards are populated
- [x] Recent critical events section is populated

### Devices tab
- [x] Three seeded devices are listed
- [x] Status badges show online / degraded / offline

### Alerts tab
- [x] Fire, gas, intrusion, and motion events are listed
- [x] Critical events have distinct color coding from warning/info

### Sensors tab
- [x] Latest telemetry readings are shown per room
- [x] Temperature, humidity, gas raw, CO raw, motion, flame, reed state are present

### Override History — admin account
- [x] Overrides screen is accessible from the Dashboard
- [x] Four seeded overrides are visible
- [x] Admin Actions card is rendered (four safe action buttons in 2×2 grid: Silence Alarm, Test Buzzer, Stop Pump, Close Valve)
- [x] Confirmation dialog shows per-action text and hazard-not-resolved notice
- [x] All four safe actions submitted and new records appear with `status: executed`

### RBAC — resident account
- [x] Log out and log in as `resident@smarthome.local`
- [x] Dashboard, Devices, Alerts, Sensors tabs are all accessible
- [x] Overrides screen is accessible
- [x] Override history is visible (read-only)
- [x] Admin Actions card is **not rendered**

---

## 10. Admin Web

**Note:** Admin-web verified at `http://localhost:5173` (local dev server) connecting to EC2 backend (`http://18.184.39.188:5000`). CORS configured on EC2 with `CORS_ORIGIN=http://localhost:5173`.

### Login
- [x] Login page loads at `http://localhost:5173`
- [x] Login with admin credentials succeeds
- [x] Invalid credentials show an inline error (no crash, no blank page)
- [x] Logout clears the session and returns to the login page

### Dashboard — admin account
- [x] Security status banner renders (Low / Elevated / High Risk)
- [x] KPI cards: Active Devices, Critical Events, Pending Overrides, Latest Telemetry
- [x] Latest Sensor Snapshot tiles render
- [x] Risk assessment panel renders

### Devices page
- [x] Device table loads with three seeded devices
- [x] Status badges render correctly
- [x] Refresh Status button completes without error

### Events page
- [x] Events table loads
- [x] Severity filter (All / info / warning / critical) re-fetches correctly
- [x] Top Incident panel populates with the highest-severity event

### Access Logs page
- [x] Access logs table loads
- [x] Outcome filter (All / granted / denied) works
- [x] Denial rate card is visible

### Telemetry page
- [x] Featured Latest Reading panel loads
- [x] Sensor tile grid renders
- [x] All Records table shows historical entries

### Overrides page — admin account
- [x] Override history table loads
- [x] Status filter re-fetches correctly
- [x] Issue Command Override form is visible
- [x] Quick Action presets (Silence Alarm, Test Buzzer, Stop Pump, Close Valve) populate the form
- [x] Action dropdown groups Safe and Advanced actions with clear optgroup labels
- [x] All four safe quick action presets executed successfully (auto-acked to `executed` on EC2)
- [x] Door Unlock is in the Advanced dropdown — stays `requested` without real ESP32 (expected by design)

### UI shell
- [x] Light / dark theme toggle switches and persists across reload
- [x] Profile page shows email, role, and user ID
- [x] Sidebar navigation switches pages without full reload

### RBAC — resident account
- [x] Log out and log in as `resident@smarthome.local`
- [x] Overrides page shows history (read-only)
- [x] Override command form is replaced with the "Admin Role Required" locked panel
- [x] No override command can be submitted

---

## 11. Push Notifications / FCM

**Setup:** `FCM_ENABLED=true` in `backend/.env`, `FIREBASE_SERVICE_ACCOUNT_BASE64` set, `google-services.json` placed in `android/app/` (not committed), app rebuilt and deployed on a physical or emulator device with Google Play Services.

Run the FCM logic tests (no Firebase or DB required):

```bash
cd backend
npm run test:fcm         # FCM disabled-mode safety
npm run test:notification # notification decision logic
```

### 11.1 Backend service tests

- [x] `npm run test:fcm` passes — all FCM disabled-mode assertions pass
- [x] `npm run test:notification` passes — all decision logic and message-building assertions pass
- **Verified:** Both tests pass as part of the 26/26 backend regression suite.

### 11.2 FCM token registration

- [x] `POST /api/users/fcm-token` with no token returns 401
- [x] `POST /api/users/fcm-token` with a resident or admin JWT and valid `fcm_token` body returns `{ "updated": true }`
- [x] `GET /health` returns `"fcm": { "enabled": true, "initialized": true }` when `FCM_ENABLED=true` and `FIREBASE_SERVICE_ACCOUNT_BASE64` is set
- [x] `GET /health` returns `"fcm": { "enabled": false, "initialized": false }` when `FCM_ENABLED=false`

### 11.3 Backend notification dispatch (requires FCM_ENABLED=true + Atlas)

- [x] After publishing `fire_detected` via mock MQTT (`POST /api/mock/mqtt`), `NotificationLog` entry with `status: sent` created for admin token, `status: skipped / duplicate_token` for resident (same physical device)
- [x] Publishing `gas_detected` event results in a `NotificationLog` entry — confirmed on EC2
- [x] Publishing `co_detected` event results in a `NotificationLog` entry — confirmed on EC2
- [x] Publishing `intrusion_detected` event results in a `NotificationLog` entry — confirmed on EC2
- [x] `heartbeat` and `telemetry` messages do NOT produce `NotificationLog` entries
- **Verified on EC2:** All four critical event types confirmed end-to-end with physical phone notification received. FCM `duplicate_token` for resident is expected — both accounts share one physical demo device.

### 11.4 Device offline push — FCM

Verified on EC2 via controlled offline transition test (heartbeat → monitor → `degraded→offline`).

- [x] When a device transitions from `degraded` to `offline`, backend calls `sendDeviceOfflineNotification`
- [x] `NotificationLog` entry with `channel: fcm`, `status: sent`, `title: "Device Offline"`, `severity: warning` is created
- [x] If the same FCM token is registered to more than one user, a second `NotificationLog` entry with `status: skipped`, `error_message: duplicate_token` is created — the token is sent to only once
- [x] No FCM notification is generated for the `online→degraded` transition — only `degraded→offline` triggers dispatch

---

### 11.5 Device offline push — SMS

**Setup:** `SMS_ENABLED=true` in `backend/.env`, Twilio credentials configured, recipient country geo permissions enabled in Twilio Console.

Backend SMS dispatch path and Twilio provider acceptance verified on EC2 (clean systemd restart, Twilio Turkey geo permission enabled). Handset delivery not yet confirmed.

- [x] Offline transition calls `sendSmsOfflineNotification` — backend SMS path exercised
- [x] `NotificationLog` entry with `channel: sms`, `status: sent`, `sent_at` populated, `error_message: null` is created — Twilio accepted the request
- [x] Twilio Message Log shows `Outgoing API` / `Sent` for the dispatched message
- [x] Exactly one SMS log entry per offline transition — no duplicates
- [x] If `SMS_ENABLED=false`, a `NotificationLog` entry with `channel: sms`, `status: skipped`, `error_message: sms_disabled` is created (no Twilio call made)
- [x] If Twilio returns an error, `error_message` is stored with E.164 phone numbers masked (e.g., `+90****20`) — not stored verbatim
- [ ] Phone receives the SMS / Twilio Message Log status becomes `Delivered`

**Controlled test procedure:** See DEMO_RUNBOOK.md §12.4 for the full step-by-step.

---

### 11.6 Android FCM receive (requires physical device or emulator with Play Services)

- [x] App builds successfully with Firebase dependencies in `android/app/build.gradle.kts`
- [x] After login, FCM token is registered via `POST /api/users/fcm-token`
- [x] When `fire_detected` event is published, push notification appears on the device within ≤ 10 s
- [x] Notification title matches `"Fire Detected"` and body mentions the room name
- [x] Tapping the notification opens the app
- [x] `gas_detected`, `co_detected`, and `intrusion_detected` events also produce push notifications
- **Verified on EC2:** All four notification types confirmed on physical phone. Admin FCM token: `sent`. Resident FCM token: `skipped / duplicate_token` (same physical device — expected).

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

**Not yet verified with real ESP32 hardware:** ESP32 firmware is not implemented (`firmware/` is empty). All sensor event flows (fire, gas, CO, intrusion, motion), NFC access control, heartbeat MQTT messages, and actuator responses (pump, valve, door) are verified via seeded data and mock MQTT only. See rows below.

| Item | Status | Owner |
|---|---|---|
| ESP32 firmware | Not implemented — `firmware/` is empty | MCH team |
| Physical home model and sensor wiring | Hardware scope | MCH team |
| Real sensor events via live MQTT | Runnable locally via `npm run mqtt:broker` + `npm run mqtt:publish:mock` (see Section 12). Live hardware events require ESP32 firmware — MCH scope. | Both teams |
| Real ESP32 heartbeat via MQTT | Device status (online/degraded/offline) displayed from seeded `last_heartbeat_at` values; backend offline monitor verified via controlled EC2 test (§14.5). Live MQTT heartbeat from real ESP32 NOT tested. | MCH + CMP |
| NFC hardware trigger → access log pipeline | Access logs seeded and visible; real RC522 NFC card scan and door unlock NOT tested — RC522 hardware integration is firmware scope | MCH team |
| Automatic fire suppression (pump + valve) | Requires firmware; software override path is implemented | MCH + CMP |
| AWS EC2 deployment | **Deployed with HTTPS.** Backend runs on EC2 behind Nginx (TLS termination). PM2 + systemd auto-start verified. Public endpoint: `https://smarthome-capstone.duckdns.org`. Port 5000 closed externally. See §15 for full HTTPS verification checklist. | CMP / infra |
| Firebase Cloud Messaging (FCM) | **Implemented and verified.** FCM offline push confirmed on EC2 (NotificationLog: `sent` + `skipped/duplicate_token`). Requires `google-services.json` in `android/app/` (not committed) and `FCM_ENABLED=true` + `FIREBASE_SERVICE_ACCOUNT_BASE64` in `backend/.env`. | CMP |
| SMS connectivity-loss notifications | **Backend/provider dispatch verified; handset delivery still needs final verification.** NotificationLog `channel=sms status=sent` confirmed on EC2; Twilio Message Log shows `Sent`. SMS did not arrive on phone and Twilio has not shown `Delivered`. See DEMO_RUNBOOK.md §12.5 troubleshooting. | CMP |

---

## 14. EC2 Deployment Verification

**Purpose:** Confirm that the production backend on AWS EC2 is deployed, healthy, and auto-restarts correctly.

### 14.1 Health check

- [x] `GET /health` on EC2 returns HTTP 200 with `status: ok`, `fcm.enabled: true`, `db.status: connected`
- [x] SMS initialization verified from PM2 startup logs — `[SMS] Twilio client initialized` appears at boot (`/health` does not include an SMS field)

### 14.2 PM2 / systemd auto-start

- [x] PM2 process `smart-home-backend` is listed as `online` after a cold system boot
- [x] `systemctl status pm2-ec2-user` shows `Active: active (running)`
- [x] Startup log confirms `[SMS] Twilio client initialized` — SMS vars loaded from `.env` at boot

### 14.3 Correct restart procedure

**Do NOT use `pm2 restart --update-env`** — this strips `.env` vars from the process environment, causing `sms_disabled` at runtime. Use instead:

```bash
# Clean restart — preserves .env vars from the saved PM2 dump
pm2 save
pm2 kill
sudo systemctl reset-failed pm2-ec2-user.service
sudo systemctl restart pm2-ec2-user
pm2 logs --lines 20
```

- [x] After clean restart: `[SMS] Twilio client initialized` appears in startup logs

### 14.4 Deploying a new backend version

```bash
git pull origin main
cd backend && npm install --omit=dev
pm2 save
pm2 restart smart-home-backend   # plain restart — no --update-env
pm2 logs --lines 20
```

- [x] `git pull` shows the expected commit hash — verified for `e46f599` (demo override auto-ack) and `30153a1` (safe admin override actions UI)
- [x] `npm install` completes without errors
- [x] PM2 restarts and `/health` returns 200 within 10 s
- **Note:** After code-only deploys, set any new env vars via `sed -i` on `.env` then `pm2 restart` (no `--update-env`). Env var count in PM2 startup log (e.g., `injected env (18)`) confirms new vars are loaded.

### 14.5 Controlled offline notification test

See DEMO_RUNBOOK.md §12.4 for the full step-by-step procedure.

Expected `NotificationLog` entries after one `online → degraded → offline` cycle:

| channel | status | notes |
|---|---|---|
| `fcm` | `sent` | First FCM token — push dispatched |
| `fcm` | `skipped` | `error_message: duplicate_token` — same token on second user |
| `sms` | `sent` | Twilio accepted the request; `sent_at` populated. Handset delivery not yet confirmed. |

- [x] FCM `sent` entry confirmed on EC2
- [x] FCM `skipped / duplicate_token` entry confirmed on EC2
- [x] NotificationLog `channel=sms status=sent` confirmed on EC2; Twilio Message Log shows `Sent`
- [ ] Phone receives the SMS / Twilio status becomes `Delivered`

---

## 15. Public HTTPS Deployment Verification

**Purpose:** Confirm that the public HTTPS deployment is functional, port hardening is in effect, and Android connects over HTTPS.

### 15.1 Architecture and Public URL

- [x] Admin-web SPA served at `https://smarthome-capstone.duckdns.org/`
- [x] Backend API proxied at `https://smarthome-capstone.duckdns.org/api/`
- [x] HTTP → HTTPS redirect enforced (301)
- [x] HSTS header present (`Strict-Transport-Security: max-age=63072000`)

### 15.2 AWS Security Group State

| Port | Status | Purpose |
|---|---|---|
| 22 | Open (restricted) | SSH access |
| 80 | Open | HTTP → HTTPS redirect |
| 443 | Open | HTTPS (Nginx TLS termination) |
| 1883 | Open | MQTT — intentionally open for future ESP32 connectivity |
| 5000 | **Closed** | Backend port hardened; internal only via Nginx proxy |

**MQTT 1883 note:** Port 1883 is open intentionally for future ESP32 MQTT connectivity. Do not close unless the MQTT broker is being retired.

### 15.3 Android HTTPS Migration

- [x] `android/app/build.gradle.kts:18` — `BASE_URL` = `"https://smarthome-capstone.duckdns.org/"` (commit `5b1cdbf`)
- [x] `android/app/src/main/res/xml/network_security_config.xml` — `cleartextTrafficPermitted="false"` (commit `5b1cdbf`)
- [x] `compileDebugKotlin` passed after both changes
- [x] Physical phone test — admin login via HTTPS passed
- [x] Physical phone test — all screens accessible (Dashboard, Devices, Alerts, Sensors, Overrides)
- [x] Physical phone test — safe override (`buzzer_off`) submitted, confirmed `status: executed` in ~500 ms
- [x] Physical phone test — resident login passed, Admin Actions card absent

### 15.4 HTTPS Endpoint Verification

Verified from external network (local Windows) and from EC2 (`curl localhost`):

- [x] `GET https://smarthome-capstone.duckdns.org/` — 200, React SPA loads
- [x] `GET https://smarthome-capstone.duckdns.org/health` — 200, `{"status":"ok","database":{"connected":true}}`
- [x] `GET https://smarthome-capstone.duckdns.org/api/events` — 200, event array
- [x] `GET http://smarthome-capstone.duckdns.org/` — 301 redirect to HTTPS
- [x] `GET http://18.184.39.188:5000/` — connection refused (port closed externally)
- [x] `GET http://localhost:5000/health` from EC2 — 200 (internal only, via Nginx)

### 15.5 Browser Admin/Resident Tests (via Public HTTPS URL)

- [x] Admin login at `https://smarthome-capstone.duckdns.org/` — authenticated
- [x] Dashboard, Devices, Events, Telemetry, Access Logs, Overrides pages — all load
- [x] Resident login — authenticated, Overrides page shows locked panel (Admin Role Required)

### 15.6 Override Execution via HTTPS

- [x] Submitted `buzzer_off` (Silence Alarm) from admin-web Overrides page via HTTPS
- [x] With `OVERRIDE_DEMO_AUTO_ACK=true`, override status became `executed` in ~500 ms
- [x] Override record visible in both admin-web and Android Overrides screen after HTTPS submission

### 15.7 Port Hardening Confirmation

- [x] Port 5000 inbound rule removed from AWS Security Group
- [x] External `http://18.184.39.188:5000` — connection refused/timeout (confirmed from local Windows)
- [x] `curl http://localhost:5000/health` on EC2 — 200 (backend still reachable internally)
- [x] All HTTPS endpoints remain fully functional after port 5000 removal

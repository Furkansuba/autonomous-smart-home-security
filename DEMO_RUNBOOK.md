# Demo Runbook — Autonomous Smart Home Security

---

## 1. Prerequisites

- Node.js >= 20
- npm
- Android Studio (with an emulator or physical device, API 26+)
- MongoDB Atlas cluster (active, with your current IP whitelisted)
- Both `backend/` and `admin-web/` dependencies installed

---

## 2. Environment Setup

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in the two required values:

```
MONGODB_URI=<your Atlas connection string>
JWT_SECRET=<any long random string for demo>
```

All other values can stay at the `.env.example` defaults.

```bash
npm install
```

---

## 3. Seed Demo Data

Run all three from the `backend/` directory:

```bash
npm run seed:demo-admin      # creates admin@smarthome.local / Admin123!
npm run seed:demo-resident   # creates resident@smarthome.local / Resident123!
npm run seed:demo            # seeds devices, events, telemetry, access logs, overrides
```

`seed:demo` is safe to re-run — it cleans existing demo records before inserting.

---

## 4. Start Backend

```bash
cd backend
npm start
```

Verify the backend is up:

```
GET http://localhost:5000/health
```

Expected: `database.connected: true` in the response. If `false`, check your `MONGODB_URI` and Atlas IP whitelist before continuing.

---

## 5. Start Admin Web

```bash
cd admin-web
npm install
npm run dev
```

Admin web runs at `http://localhost:5173`.

---

## 6. Run Android App

Open the `android/` directory in Android Studio and run on an emulator or physical device.

**Emulator:** No changes needed. `BASE_URL` defaults to `http://10.0.2.2:5000/` which routes to the host machine.

**Physical phone:** Change `BASE_URL` in `android/app/build.gradle.kts` line 17 to your PC's LAN IP before building:

```kotlin
buildConfigField("String", "BASE_URL", "\"http://192.168.x.x:5000/\"")
```

Rebuild the app after changing it.

---

## 7. Demo Credentials

| Role     | Email                        | Password       |
|----------|------------------------------|----------------|
| Admin    | `admin@smarthome.local`      | `Admin123!`    |
| Resident | `resident@smarthome.local`   | `Resident123!` |

---

## 8. Android Demo Flow

### 8.1 Biometric Unlock — Stored-Session Flow

The Android biometric feature is a **stored-session unlock**, not a standalone biometric authentication. It only appears when a valid JWT from a previous password login is already stored on the device. It is a convenience feature — the underlying authentication is always the password + server-issued token.

**To demonstrate biometric unlock:**

1. Log in with `admin@smarthome.local` / `Admin123!` using the password form.
2. Force-close the app (swipe it away from the recents menu).
3. Relaunch the app — the biometric prompt appears automatically.
4. Authenticate with the enrolled fingerprint — the app navigates directly to Dashboard without re-entering a password.
5. Tap **Use password** at any time to fall back to the credential form.

**Note:** The biometric prompt does not appear on a fresh install or after logout, because there is no stored session token. Enroll a fingerprint at **Android Settings → Security → Fingerprint** if the prompt does not appear.

---

### 8.2 Android Demo Flow — Admin Account

**Login:**
1. Launch the app — the Login screen appears.
2. Enter `admin@smarthome.local` / `Admin123!` and tap **Login**.

**Dashboard (Home tab):**
3. After login, the Dashboard shows device summary cards and recent critical events.
4. Tap a device card to jump to the Devices tab; tap an event card to jump to the Alerts tab.

**Devices tab:**
5. Lists all three seeded devices with **online / degraded / offline** status badges.

**Alerts tab:**
6. Shows fire, gas, intrusion, and motion events with severity color coding (critical / warning / info).
7. Point out the `fire_detected` (kitchen) and `gas_detected` (garage) events — both show as critical.

**Sensors tab:**
8. Shows the latest telemetry reading per room — temperature, humidity, gas raw, CO raw, motion, flame, reed state.

**Override History:**
9. From the Dashboard, open the Overrides screen via the pending overrides card.
10. Four seeded overrides are shown:
    - `requested` — buzzer_off pending
    - `executed` — door_unlock completed
    - `failed` — valve_open on degraded device
    - `blocked` — pump_on blocked by gas/CO lockout rule

**Silence Alarm (admin-only action):**
11. At the top of the Overrides screen, the **Admin Action** card is visible.
12. Tap **Silence Alarm** → confirm in the dialog.
13. The app sends a `buzzer_off` command to `esp32_home_01`.
14. The new override record appears in the history list.

---

### 8.3 Android Demo Flow — Resident Account

15. Tap the Profile tab → **Logout**.
16. Log in as `resident@smarthome.local` / `Resident123!`.
17. Navigate through Dashboard, Devices, Alerts, and Sensors — all are accessible in read-only mode.
18. Open the Overrides screen — the four override history records are visible.
19. The **Silence Alarm Admin Action card is not rendered** — the admin-only section is completely absent from the UI.

---

## 9. Admin Web Demo Flow

### 9.1 Admin Web Demo — Admin Account

1. Open `http://localhost:5173` and log in as `admin@smarthome.local`.
2. **Dashboard:** Security status banner (Low / Elevated / High Risk), KPI cards (Active Devices, Critical Events, Pending Overrides, Latest Telemetry), latest sensor snapshot tiles, risk assessment panel.
3. **Devices:** Table with three seeded devices and status badges. The **Refresh Status** button recalculates statuses from heartbeat timestamps.
4. **Events:** Fire, gas, intrusion, and motion events. Use the severity filter to narrow to `critical` events only.
5. **Access Logs:** NFC access history with four granted entries and one denied. Use the outcome filter; the denial rate card color-codes red when denials are high.
6. **Telemetry:** Featured latest reading panel, sensor tile grid, full historical table.
7. **Overrides:** Override history with status filter. The **Issue Command Override** form is visible. Use the Quick Action preset **Buzzer Off** to populate the form, then submit — the new record appears in the history table.

---

### 9.2 Admin Web Demo — Resident RBAC Check

8. Log out via the avatar menu → **Logout**.
9. Log in as `resident@smarthome.local`.
10. Open the **Overrides** page — override history is visible (read-only).
11. The command form is replaced with a locked panel:

    > *"Admin Role Required — Manual override controls are restricted to admin accounts."*

12. All other pages (Dashboard, Devices, Events, Telemetry, Access Logs) remain accessible in read-only mode.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Backend exits on start or `/health` returns `database.connected: false` | `MONGODB_URI` in `backend/.env` is missing or contains placeholder text. Verify the Atlas connection string. |
| Atlas connection refused | Your current IP is not in the Atlas Network Access whitelist. Add it at **Atlas → Network Access → Add IP Address**. |
| Android emulator shows "Unable to connect" | Verify the backend is running and reachable at `http://localhost:5000/health` on the host. The default `BASE_URL` (`10.0.2.2:5000`) is correct for the Android emulator. |
| Physical phone shows "Unable to connect" | Change `BASE_URL` in `android/app/build.gradle.kts:17` to your PC's LAN IP (e.g., `http://192.168.1.x:5000/`) and rebuild. |
| Biometric prompt does not appear | The device has no enrolled fingerprint, or there is no stored session. Enroll a fingerprint at **Android Settings → Security → Fingerprint**, then log in once via password. The biometric prompt appears only on subsequent launches with a stored session. |
| Silence Alarm card missing on Android | The session is logged in as `resident`. Log out and log back in as `admin@smarthome.local`. |
| Seed scripts fail with a connection error | Run `npm run test:db` from `backend/` first to verify Atlas connectivity before seeding. |

---

## 11. Capstone Requirement Coverage

This section maps each objective from the capstone proposal (§1.3, §7.2) to the current state of the software repository. Items are marked honestly — the evaluation panel should treat partial items and known gaps as-is rather than as claimed complete.

---

### §1.3 Project Objectives

| Objective | Status | Notes |
|---|---|---|
| Multi-room prototype (kitchen, living room, bedrooms, garage) with sensors and actuators | **Backlog — MCH scope** | Physical model is not in this repo. Room IDs (`kitchen`, `living_room`, `bedroom_1`, `bedroom_2`, `garage`, `hallway`) are defined in the contract and used in seeded data. |
| Detect fire, gas, vibration/intrusion, NFC access events | **Partially done** | Backend pipeline handles all event types with correct severity routing. Seeded data demonstrates the full flow. Real hardware sensor triggers require ESP32 firmware — `firmware/` is empty in this repo. |
| NFC door access control — record all access attempts | **Partially done** | Access log data model, REST API, admin-web Access Logs page, and Android Alerts tab are all complete. Seeded records include granted and denied entries. Live RC522 hardware integration is MCH/firmware scope. |
| Complete software system — user registration, RBAC, dashboards, audit logging | **Done** | JWT auth, admin/resident RBAC, all 7 admin-web pages, all Android screens (Login, Dashboard, Devices, Alerts, Sensors, Overrides, Profile), both roles fully working. |
| Real-time alerting ≤ 5–10 s + heartbeat offline detection | **Partially done** | Heartbeat offline detection is fully implemented (0–60 s: online, 61–90 s: degraded, > 90 s: offline). FCM push notifications are not implemented; alert delivery time cannot be measured without live hardware and FCM. |
| Automatic + manual safety responses — authorized override path | **Partially done** | Manual override is fully implemented with RBAC (admin only), gas/CO pump lockout enforced (seeded blocked record), and override history logged. Automatic fire suppression (pump + valve activation) requires firmware. |

---

### §7.2 Success Criteria

| Criterion | Status | Notes |
|---|---|---|
| Events transmitted, processed, stored, and displayed end-to-end | **Done** (via seeded data path) | All event types stored in MongoDB, surfaced via REST API, displayed in both apps. Live MQTT path is implemented but `MQTT_ENABLED=false` by default; no live broker is configured. |
| Heartbeat timeout → device marked offline → logged | **Done** | Backend calculates device status from `last_heartbeat_at`. `POST /api/devices/refresh-status` forces recalculation. All three status states demonstrated by seeded devices. |
| Critical events → push notification to mobile | **Not done** | FCM is not implemented. `android/app/build.gradle.kts` has no Firebase dependencies. No `google-services.json` is present. This is a known gap. |
| Connectivity loss → SMS notification | **Not done** | SMS notifications are not implemented anywhere in the repo. This is a known gap. |
| Authentication and authorization prevent unauthorized actions | **Done** | JWT required on all write endpoints. RBAC enforced: resident blocked from POST `/api/overrides` (403) and `POST /api/devices/refresh-status` (401). Client-provided roles are never trusted. |
| Mobile app and admin panel show clear, readable status and logs | **Done** | Both apps show device status badges, event severity, access log outcomes, override status, and telemetry readings with clear labels. |

---

### Technology Stack Status

| Component | Status | Notes |
|---|---|---|
| Node.js + Express backend | **Done** | Running on port 5000. All REST endpoints implemented. |
| MongoDB Atlas | **Done** | Mongoose models for all collections. Seed scripts provided. |
| JWT + RBAC authentication | **Done** | Login, `/api/auth/me`, RBAC middleware on admin-only routes. |
| MQTT event ingestion (backend) | **Implemented; unverified live** | `MQTT_ENABLED=false` by default. Backend MQTT router and ingestion logic are present. Live end-to-end requires a running broker and ESP32 firmware. |
| Kotlin Android (Jetpack Compose, MVVM) | **Done** | All screens implemented. Repository pattern. Observable state via ViewModel. |
| Biometric unlock (Android) | **Done — stored-session only** | Convenience unlock using stored JWT. Not a standalone biometric authentication flow. |
| React admin web | **Done** | All 7 pages implemented. Light/dark theme. RBAC gating on Overrides page. |
| Firebase Cloud Messaging (FCM) | **Not implemented** | No Firebase dependency in Android. No FCM send logic in backend. |
| AWS EC2 deployment | **Not deployed** | Backend runs locally. No EC2 instance configured. |
| ESP32 firmware | **Not in repo** | `firmware/` directory contains only `.gitkeep`. Firmware is MCH team scope. |

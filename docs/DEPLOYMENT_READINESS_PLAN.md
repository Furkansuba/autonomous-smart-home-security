# Deployment Readiness Plan

## Autonomous Smart Home Security

**Date:** 2026-06-02
**Status:** Pre-deployment checklist — provider not yet selected

---

## 1. Current Local Architecture

| Layer | Technology | Local default |
|---|---|---|
| Frontend | React + Vite (`admin-web/`) | `http://localhost:5173` |
| Backend | Node.js + Express (`backend/`) | `http://localhost:5000` |
| Database | MongoDB Atlas | Cloud (URI in `.env`) |
| MQTT | Optional, disabled by default | `mqtt://localhost:1883` |

The frontend resolves the backend address from `VITE_API_BASE_URL` (configured in `admin-web/src/config/api.js`). The backend restricts CORS to the origin set in `CORS_ORIGIN` (configured in `backend/src/config/env.js`).

---

## 2. Target Deployment Architecture

```
[ Browser ]
    |
    v
[ Frontend — static Vite build ]
    |  VITE_API_BASE_URL -> public backend URL
    v
[ Backend — Node/Express API service ]
    |  MONGODB_URI -> MongoDB Atlas
    |  MQTT_ENABLED=false (web demo) or -> production broker
    v
[ MongoDB Atlas — cloud database ]
```

- Frontend is built with `npm run build` and served as static files.
- Backend runs as a Node process (`node src/server.js`), requires Node >= 20.
- MongoDB Atlas remains the database; no self-hosted database is needed.
- A deployment provider has not been selected yet. This document is provider-neutral.

---

## 3. Backend Production Environment Variables

All variables are loaded via `dotenv` in `backend/src/config/env.js`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Set to `production` in deployment |
| `PORT` | No | `5000` | Port the Express server listens on |
| `MONGODB_URI` | Yes | _(empty)_ | Full MongoDB Atlas connection string; must not contain placeholder text |
| `MONGODB_DNS_SERVERS` | No | _(empty)_ | Comma-separated custom DNS servers for Atlas connectivity if needed |
| `JWT_SECRET` | Yes | _(empty)_ | Must be a long, randomly generated secret; never use a dev value in production |
| `JWT_EXPIRES_IN` | No | `1d` | Token lifetime; adjust per security policy |
| `CORS_ORIGIN` | Yes | `http://localhost:5173` | Must be set to the deployed frontend public URL |
| `MQTT_ENABLED` | No | `false` | Set to `true` only if a production MQTT broker is configured |
| `MQTT_BROKER_URL` | If MQTT enabled | `mqtt://localhost:1883` | Public broker URL |
| `MQTT_CLIENT_ID` | If MQTT enabled | `smart_home_backend` | Unique client identifier |
| `MQTT_USERNAME` | If MQTT enabled | _(empty)_ | Broker credential |
| `MQTT_PASSWORD` | If MQTT enabled | _(empty)_ | Broker credential |
| `MQTT_SUBSCRIBE_TOPICS` | If MQTT enabled | `home/+/heartbeat,...` | Comma-separated topic list |

Store all secrets in the hosting provider's environment variable or secrets manager. Never commit `.env` to the repository. Use `.env.example` as the template.

---

## 4. Frontend Production Environment Variable

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | The deployed backend public URL (e.g., `https://your-backend-host`) |

Set this before running `npm run build`. Vite bakes the value into the static bundle at build time. If the variable is not set, the frontend defaults to `http://localhost:5000`, which will not work in a deployed environment.

Build command:

```
cd admin-web
npm run build
```

Serve the resulting `admin-web/dist/` directory as static files.

---

## 5. CORS Checklist

- [ ] Identify the frontend deployed public URL.
- [ ] Set `CORS_ORIGIN` on the backend to that exact URL — no trailing slash.
- [ ] Do not use `*` as the CORS origin in production; the app uses `Authorization` headers.
- [ ] Verify that `http://localhost:5173` is removed from the production backend config.
- [ ] After deploying, confirm the login request from the frontend succeeds without a CORS error.

---

## 6. MongoDB Atlas Checklist

- [ ] Confirm the Atlas cluster is active and the target database name matches `MONGODB_URI`.
- [ ] Allow the deployed backend server IP or hosting provider outbound IP in MongoDB Atlas network access.
- [ ] Configure Atlas network access according to the selected hosting provider outbound IP range or service.
- [ ] Do not use `0.0.0.0/0` (allow all) in production Atlas network access unless it is a temporary demo-only decision.
- [ ] Verify that `MONGODB_URI` does not contain placeholder strings (`username:password`, `change_this`, `<db_password>`, `...`). The backend rejects URIs containing these strings.
- [ ] Confirm the Atlas database user has read/write access to the target database only.
- [ ] Do not expose the Atlas URI in logs, API responses, or frontend code.

---

## 7. JWT / Auth Safety Checklist

- [ ] `JWT_SECRET` must be replaced with a long, randomly generated value before any production deployment.
- [ ] Do not reuse the development secret.
- [ ] The secret must be stored as a secure environment variable, not in source code.
- [ ] `JWT_EXPIRES_IN` should be reviewed and set to an appropriate session lifetime for the deployment context.
- [ ] Demo credentials (`admin@smarthome.local` / `Admin123!`) must not be exposed publicly. Remove or replace the demo admin account before any public-facing deployment.

---

## 8. MQTT Deployment Decision

MQTT is **disabled by default** (`MQTT_ENABLED=false`). The backend starts and operates normally without MQTT.

For a web demo:

- Leave `MQTT_ENABLED=false`.
- All API endpoints function without MQTT.
- Device status and events are driven by seeded or previously persisted data.
- No real MQTT messages from hardware are required.

For a production deployment with live ESP32 hardware:

- A publicly reachable MQTT broker must be provisioned and secured.
- `MQTT_ENABLED=true`, `MQTT_BROKER_URL`, `MQTT_CLIENT_ID`, `MQTT_USERNAME`, and `MQTT_PASSWORD` must all be set.
- The backend MQTT subscribe topics must match the device firmware topic pattern (`home/+/heartbeat`, `home/+/telemetry`, etc.).

**Do not claim production MQTT is deployed unless a broker is configured and verified end-to-end.**

---

## 9. Demo Account and Seed Data Decision

The backend includes three seed scripts:

| Script | Purpose |
|---|---|
| `npm run seed:demo-admin` | Creates the admin user account |
| `npm run seed:demo` | Populates devices, events, access logs, telemetry, and overrides |
| `npm run clean:demo` | Removes all seeded demo data |

Before a demo:

- [ ] Run `seed:demo-admin` to create the login account.
- [ ] Run `seed:demo` to populate data visible in the admin web.
- [ ] Confirm the admin web login succeeds and all pages display data.

Before any public-facing deployment:

- [ ] Change or remove the default demo credentials.
- [ ] Do not leave known default credentials active on a publicly accessible instance.
- [ ] Decide whether to clean demo data and seed production-appropriate records, or keep demo data for a controlled demo environment.

---

## 10. Deployment Order

Deploy in this order. Do not deploy the frontend before the backend is verified.

### Step 1 — Deploy the backend

1. Provision a server or hosting service (provider not yet selected).
2. Set all required environment variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`.
3. Install dependencies: `npm install --omit=dev`.
4. Start the process: `node src/server.js` (or via a process manager).
5. Verify the health endpoint responds:
   ```
   GET /health
   ```
   Expected response: `{ "status": "ok", "database": { ... }, "mqtt": { ... } }`
6. Verify `database.connected` is `true` in the health response.
7. Run a smoke test against `/api/auth/login` with the seeded admin credentials.

### Step 2 — Seed data

1. Run `npm run seed:demo-admin` against the production database.
2. Run `npm run seed:demo` if demo data is needed.

### Step 3 — Deploy the frontend

1. Set `VITE_API_BASE_URL` to the deployed backend public URL.
2. Build: `npm run build` inside `admin-web/`.
3. Deploy the `admin-web/dist/` directory as static files.
4. Verify the login page loads at the deployed frontend URL.
5. Log in and confirm the Dashboard loads data from the backend.

---

## 11. Post-Deploy Test Checklist

Run through each item after both services are deployed.

### Auth

- [ ] Login page loads without errors
- [ ] Login with seeded admin credentials succeeds
- [ ] Invalid credentials show an inline error
- [ ] Logout clears the session and returns to the login page

### Dashboard

- [ ] Security status banner renders (Low / Elevated / High Risk)
- [ ] KPI cards show values (Active Devices, Critical Events, Pending Overrides, Latest Telemetry)
- [ ] Latest Sensor Snapshot tiles render
- [ ] Risk Assessment panel renders

### Devices

- [ ] Device table loads and shows registered devices
- [ ] Status badges render correctly
- [ ] Refresh Status button completes without error

### Events

- [ ] Events table loads
- [ ] Severity filter (All / info / warning / critical) re-fetches correctly
- [ ] Top Incident panel populates

### Access Logs

- [ ] Access logs table loads
- [ ] Outcome filter (All / granted / denied) re-fetches correctly
- [ ] Denial Rate card color-codes correctly

### Telemetry

- [ ] Featured Latest Reading panel loads
- [ ] Sensor tile grid renders
- [ ] All Records table loads historical entries

### Overrides

- [ ] Overrides table loads
- [ ] Status filter re-fetches correctly
- [ ] Issue Command Override form submits and shows result
- [ ] Quick Action preset buttons populate the form fields

### UI / Shell

- [ ] Light / Dark theme toggle switches and persists across reload
- [ ] Profile page shows the logged-in user's email, role, and user ID
- [ ] Topbar avatar menu opens Profile and Logout correctly
- [ ] Sidebar navigation switches pages without full reload

### Backend regression

- [ ] Run `npm run test:backend` on the backend and confirm all checks pass

---

## 12. Known Non-Goals

The following are explicitly **not** claimed or expected at deployment time:

- No real-time streaming or WebSocket connection. All data is fetched on page load or filter change.
- No external charting or UI component libraries. All visualizations use plain CSS and inline SVGs.
- No production MQTT unless a broker is separately configured and verified.
- No public demo credentials in the UI. Default credentials are for local development only.
- No provider-specific deployment steps are documented here. Provider selection is pending.
- No Android app or ESP32 firmware deployment is covered by this plan. This plan covers only the backend API and admin web frontend.

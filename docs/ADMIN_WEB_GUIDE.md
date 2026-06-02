# Admin Web Guide

This document describes the admin web frontend for the Autonomous Smart Home Security project.

## Location

```
admin-web/
```

Framework: React + Vite

## Starting the Backend Locally

The admin web requires the backend to be running.

```
cd backend
npm run dev
```

Default backend URL: `http://localhost:5000`

Seed demo admin before first login if needed:

```
cd backend
npm run seed:demo-admin
```

Seed demo data:

```
cd backend
npm run seed:demo
```

Clean demo data:

```
cd backend
npm run clean:demo
```

## Starting Admin Web Locally

```
cd admin-web
npm install
npm run dev
```

Local URL: `http://localhost:5173`

## Building Admin Web

```
cd admin-web
npm run build
```

Expected result: Vite build completes without errors.

## Backend URL Override

The backend base URL defaults to `http://localhost:5000` and is configured in:

```
admin-web/src/config/api.js
```

To override:

```
VITE_API_BASE_URL=http://your-backend-host:5000
```

Set this in an `.env.local` file or as an environment variable before running `npm run dev` or `npm run build`.

## Login Flow

The admin web opens a branded login page when no valid session exists.

- Page title: **Smart Home Security — Security Operations Portal**
- Fields: Email Address, Password
- On submit: calls `POST /api/auth/login` via `authService`
- On success: JWT token and user object are stored in `localStorage`; the app shell loads immediately
- On failure: an inline error message is displayed

After login the user lands on the Dashboard.

> **Security note:** Demo credentials (`admin@smarthome.local` / `Admin123!`) are for local development only. Do not expose them in production environments.

## Light / Dark Theme Toggle

The Topbar contains a theme toggle button. Clicking it switches between light and dark mode. The selected theme is persisted to `localStorage` under the key `admin-theme` and restored on page reload.

The theme class (`theme-light` or `theme-dark`) is applied to the root `app-shell` element.

## App Shell Layout

After login the full shell renders:

- **Sidebar** (left) — navigation links to all pages
- **Topbar** (top) — page title, theme toggle, user avatar menu, logout
- **Main content area** — active page content

The Topbar avatar shows the first letter of the logged-in user's email. Clicking it opens a menu with a link to Profile and a Logout action. Logout clears the stored token and user, returning to the login page.

## Dashboard

Route key: `dashboard`

The Dashboard provides an at-a-glance security overview sourced from `GET /api/dashboard/summary`.

### Security Status Banner

A full-width banner at the top shows the current security posture:

- **Low Risk** — no critical events in the last 24 hours
- **Elevated Risk** — 1–2 critical events
- **High Risk** — 3 or more critical events

The banner color reflects the risk level (green / amber / red).

### KPI Cards

Four metric cards are displayed in a grid:

| Card | Source field |
|---|---|
| Active Devices | `devices.total_active` |
| Critical Events | `events.recent_critical_24h_count` |
| Pending Overrides | `overrides.pending_count` |
| Latest Telemetry | `telemetry.latest[0].temperature_c` |

### Latest Sensor Snapshot

A sensor tile grid shows five readings from the most recent telemetry record:

- **Temperature** — color-coded: normal / warn (>30 °C) / alert (>40 °C)
- **Humidity**
- **Motion** — warn if detected
- **Flame** — alert if detected
- **Gas** — alert if detected

A footer row summarises the signal states and latest reading.

### Device Connectivity Panel

Shows total active device count with a connectivity dot indicator (green if devices are online, neutral otherwise).

### Risk Assessment Panel

Derives a risk score from critical events and pending overrides (capped at 100). Displays a labeled score (Low / Moderate / Elevated / High Attention) with a color-coded progress bar.

### Summary Info Panels

Three smaller panels at the bottom: System Health, Security Overview, Recent Activity.

## Devices — Device Fleet

Route key: `devices`

Service: `admin-web/src/services/deviceService.js`

Endpoints used:
- `GET /api/devices`
- `POST /api/devices/refresh-status`

### Fleet Summary Cards

Four summary cards above the table:

- **Total Devices** — all registered controllers
- **Online** — devices currently reporting heartbeat
- **Offline** — devices with no heartbeat detected
- **Active** — devices enabled for operations

### Controller Health Overview Panel

- Status distribution row (online / degraded / offline dots)
- Last Heartbeat timestamp (most recent across all devices)
- Firmware version(s) in use

### Operations Toolbar

A **Refresh Status** button triggers `POST /api/devices/refresh-status` to recalculate heartbeat status for all registered devices. A success or error message is shown inline after the request completes. The device list reloads automatically after a successful refresh.

### Device Table

Columns: Device ID, Name, Status, Firmware, Last Heartbeat, Active

The Status column uses a color-coded `Badge` component (`online` / `degraded` / `offline`).

## Events — Security Events / Incident Monitoring

Route key: `events`

Service: `admin-web/src/services/eventService.js`

Endpoint: `GET /api/events`

### Summary Cards

Four cards: Total Events, Critical, Warning, Info. Each shows count and percentage of the current view.

### Severity Distribution Panel

Horizontal bars for Critical / Warning / Info, showing counts relative to the total. A footer line labels the active filter and total count.

### Top Incident Panel

A spotlight card highlights the highest-severity, most-recent event in the current view. Fields shown: Type, Room, Device, Occurred At.

### Filter Bar

Tab-style filter: **All / info / warning / critical**. Changing the filter re-fetches from the backend with the `severity` query parameter.

### Events Table

Columns: Event ID, Device, Room, Type, Severity, Message, Confirmed, Occurred At

The Severity column uses a color-coded `Badge` component.

## Access Logs — Access Control Audit

Route key: `access-logs`

Service: `admin-web/src/services/accessLogService.js`

Endpoint: `GET /api/access-logs`

### Summary Cards

Four cards: Total Attempts, Granted, Denied, Denial Rate. The Denial Rate card color-codes: green at 0 %, amber below 50 %, red at 50 %+.

### Outcome Distribution Panel

Horizontal bars for Granted and Denied, proportional to the current view total.

### Latest Attempt Panel

A spotlight card shows the most recent log entry: Gate, User, Device, Method, Occurred At. The panel border color reflects the access result (green / red).

### Filter Bar

Tab-style filter: **All / granted / denied**. Changing the filter re-fetches with the `result` query parameter.

### Access Logs Table

Columns: Access ID, Device, Gate, User, Method, Result, Occurred At

The Result column uses a color-coded `Badge` component.

## Telemetry — Sensor Monitoring

Route key: `telemetry`

Service: `admin-web/src/services/telemetryService.js`

Endpoints used:
- `GET /api/telemetry`
- `GET /api/telemetry/latest`

Both endpoints are called in parallel on page load.

### Page Header Chips

When a latest reading is available, a row of inline chips appears in the page header showing: Room, Temp, Humidity, Motion, Flame, Gas. Alert-state chips are highlighted.

### Featured Latest Reading Panel

A structured field grid shows all fields of the most recent telemetry record:

- Device ID, Room, Temperature (°C), Humidity (%), Motion, Flame, Gas, Recorded At

Alert values (detected sensors) are highlighted in red.

### Environmental Sensors Tile Grid

Five sensor tiles with inline SVG icons: Temperature, Humidity, Motion, Flame, Gas. Tiles use the same ok / alert color states as the dashboard snapshot.

### All Records Table

Columns: Device, Room, Temp (°C), Humidity (%), Motion, Flame, Gas, Recorded At

No filter is applied to this table. All historical records returned by the API are shown.

There are no charts or external charting libraries in the telemetry page. Data is displayed as plain values.

## Overrides — Command Override Center

Route key: `overrides`

Service: `admin-web/src/services/overrideService.js`

Endpoints used:
- `GET /api/overrides`
- `POST /api/overrides`

### Operations Stats Row

The page header includes a live stats row showing counts for the current view:

- **Pending** (status: `requested`)
- **Executed** (status: `executed`)
- **Failed / Blocked** (status: `failed` or `blocked`)
- **Total Requests**

### Filter Bar

Tab-style filter: **All / requested / executed / failed / blocked**. Changing the filter re-fetches with the `status` query parameter.

### Overrides Table

Columns: Override ID, Device, Requested By, Actuator, Action, Reason, Status, Requested At, Result At

The Status column uses a color-coded `Badge` component.

### Command Panel

Below the table is the command interface. It has two sections:

**Quick Actions** — three preset buttons that populate the form fields:

| Button | Actuator | Action |
|---|---|---|
| Buzzer Off | `buzzer_01` | `buzzer_off` |
| Buzzer On | `buzzer_01` | `buzzer_on` |
| Door Unlock | `door_01` | `door_unlock` |

**Issue Command Override form** — fields:

- **Device ID** (text input, defaults to `esp32_home_01`)
- **Actuator ID** (text input)
- **Action** (dropdown: `pump_on`, `pump_off`, `valve_open`, `valve_close`, `buzzer_on`, `buzzer_off`, `door_unlock`, `system_reset`)
- **Reason** (text input, max 240 characters)

On submit: calls `POST /api/overrides` with the logged-in user's `user_id` as `requested_by`. A success or error message is shown inline. The override list reloads automatically after a successful submission.

## Profile — Account Identity

Route key: `profile` (accessed from the Topbar avatar menu)

Shows the authenticated administrator's profile read from `localStorage`:

- Large avatar circle displaying the first letter of the email
- Role badge (e.g., `ADMIN`)
- Field grid: Email, Role, User ID, Account Status

No edit functionality is present. The page is read-only.

## Shared UI Components

All pages share a set of common UI components located in `admin-web/src/components/ui/`:

| Component | Purpose |
|---|---|
| `Badge` | Color-coded status chip (online/offline/degraded/granted/denied/critical/warning/info/requested/executed/failed/blocked) |
| `FilterBar` | Tab-style filter button group |
| `DataTable` | Scrollable table wrapper with consistent column headers |
| `StateMessage` | Unified loading / error / empty state message |

Layout components in `admin-web/src/components/layout/`:

| Component | Purpose |
|---|---|
| `Sidebar` | Left navigation with active-link highlighting |
| `Topbar` | Top bar: page title, theme toggle, avatar menu, logout |

## Verification Checklist

Before committing admin-web changes:

```
cd admin-web
npm run build
```

Before closing a major frontend phase:

```
cd backend
npm run test:backend
```

Expected backend result: All backend regression checks passed.

## Notes

- All admin-web changes are frontend-only. No backend code was modified as part of the UI work.
- The admin web consumes existing backend REST APIs. There is no real-time streaming or WebSocket connection.
- No external charting or component libraries were added. All data visualizations use plain CSS bars and inline SVGs.
- Deployment to AWS EC2 has not been completed yet.

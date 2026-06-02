# Phase 5 Admin Web Summary

## Status

Phase 5 implemented the React/Vite admin web frontend, connected it to the completed backend API platform, introduced a shared component library, applied a full visual redesign across all pages, and delivered a polished, build-verified UI.

## Completed Work

### Admin Web Baseline

- React + Vite project scaffolded under `admin-web/`
- Claude Code guardrails applied (`admin-web/` guardrails in CLAUDE.md)
- App shell with route-key–based page switching

### Auth / Login Flow

- `LoginPage` component: branded shield icon, "Smart Home Security — Security Operations Portal" title, email and password fields
- `authService` (`admin-web/src/services/authService.js`): login, logout, `localStorage` token and user persistence, `isAuthenticated` and `getStoredUser` helpers
- On login success: app shell renders immediately without a page reload
- On logout: token and user cleared, login page restored

### API Client Skeleton

- `apiClient` (`admin-web/src/services/apiClient.js`): uses native `fetch`, prefixes backend base URL, attaches `Authorization: Bearer` header, parses JSON safely, throws readable errors on non-2xx responses
- Backend URL configured in `admin-web/src/config/api.js`, default `http://localhost:5000`, overridable via `VITE_API_BASE_URL`

### Dashboard Summary API Integration

- Service: `admin-web/src/services/dashboardService.js`
- Endpoint: `GET /api/dashboard/summary`
- Displays: active device count, critical events in last 24 h, pending override count, latest telemetry reading

### Devices API Integration

- Service: `admin-web/src/services/deviceService.js`
- Endpoints: `GET /api/devices`, `POST /api/devices/refresh-status`
- Displays: device list with status, firmware version, last heartbeat, active flag

### Events API Integration

- Service: `admin-web/src/services/eventService.js`
- Endpoint: `GET /api/events` (with optional `severity` query param)
- Displays: event list filtered by severity; re-fetches on filter change

### Access Logs API Integration

- Service: `admin-web/src/services/accessLogService.js`
- Endpoint: `GET /api/access-logs` (with optional `result` query param)
- Displays: access log list filtered by result; re-fetches on filter change

### Telemetry API Integration

- Service: `admin-web/src/services/telemetryService.js`
- Endpoints: `GET /api/telemetry`, `GET /api/telemetry/latest` (called in parallel)
- Displays: featured latest reading panel + full historical records table

### Overrides API Integration

- Service: `admin-web/src/services/overrideService.js`
- Endpoints: `GET /api/overrides` (with optional `status` query param), `POST /api/overrides`
- Displays: override list filtered by status; create override form submits to backend; list reloads after success

## Connected Backend APIs

```
POST /api/auth/login
GET  /api/auth/me
GET  /api/dashboard/summary
GET  /api/devices
POST /api/devices/refresh-status
GET  /api/events
GET  /api/access-logs
GET  /api/telemetry
GET  /api/telemetry/latest
GET  /api/overrides
POST /api/overrides
```

## UI Refactor

### Layout Components

Two layout components were introduced in `admin-web/src/components/layout/`:

| Component | Role |
|---|---|
| `Sidebar` | Left navigation; highlights the active page; drives page switching via `onNavigate` callback |
| `Topbar` | Top bar; displays page title, light/dark theme toggle, user avatar menu, logout action |

The avatar in the Topbar shows the first letter of the logged-in user's email. The dropdown menu links to the Profile page and provides logout.

### Page Components

Each route key maps to a dedicated page component under `admin-web/src/pages/`:

| File | Page |
|---|---|
| `DashboardPage.jsx` | Security Dashboard |
| `DevicesPage.jsx` | Device Fleet |
| `EventsPage.jsx` | Security Events / Incident Monitoring |
| `AccessLogsPage.jsx` | Access Control Audit |
| `TelemetryPage.jsx` | Sensor Monitoring |
| `OverridesPage.jsx` | Override Operations / Command Center |
| `ProfilePage.jsx` | Account Identity |

### Shared UI Components

A reusable component library was added in `admin-web/src/components/ui/`:

| Component | Purpose |
|---|---|
| `Badge` | Color-coded status chip for device status, event severity, access result, and override status |
| `FilterBar` | Tab-style filter button group; drives re-fetch on change |
| `DataTable` | Scrollable table wrapper with consistent `<thead>` column headers |
| `StateMessage` | Unified loading / error / empty-state message block |

All six data pages use these four components. No external component libraries were added.

### Light / Dark Theme

- Toggle button lives in the Topbar
- Theme state is managed in `App.jsx` and stored in `localStorage` under key `admin-theme`
- Applied as a CSS class (`theme-light` / `theme-dark`) on the root `app-shell` element
- Persists across page reloads

## Final Visual Redesign

### Security Dashboard (`DashboardPage`)

- Full-width security status banner: Low Risk / Elevated Risk / High Risk with matching accent color
- KPI grid: Active Devices, Critical Events (last 24 h), Pending Overrides, Latest Telemetry
- Latest Sensor Snapshot panel: five sensor tiles (Temperature, Humidity, Motion, Flame, Gas) with color-coded alert states
- Device Connectivity panel with online/offline dot indicator
- Risk Assessment panel: derived risk score with a color-coded CSS progress bar (Low / Moderate / Elevated / High Attention)
- System Health, Security Overview, and Recent Activity summary info panels

### Device Fleet (`DevicesPage`)

- Fleet summary cards: Total Devices, Online, Offline, Active
- Controller Health Overview panel: status distribution dots, last heartbeat timestamp, firmware version(s)
- Operations toolbar: Refresh Status button with inline feedback message
- Device table: Device ID, Name, Status (`Badge`), Firmware, Last Heartbeat, Active

### Incident Monitoring (`EventsPage`)

- Summary cards: Total Events, Critical, Warning, Info (with percentage of view)
- Severity Distribution panel with CSS horizontal bars (Critical / Warning / Info)
- Top Incident spotlight panel: highest-severity + most-recent event with fields Type, Room, Device, Occurred At
- FilterBar: All / info / warning / critical
- Events table: Event ID, Device, Room, Type, Severity (`Badge`), Message, Confirmed, Occurred At

### Access Audit (`AccessLogsPage`)

- Summary cards: Total Attempts, Granted, Denied, Denial Rate (rate color-coded green / amber / red)
- Outcome Distribution panel with CSS bars (Granted / Denied)
- Latest Attempt spotlight panel: Gate, User, Device, Method, Occurred At; border color reflects result
- FilterBar: All / granted / denied
- Access logs table: Access ID, Device, Gate, User, Method, Result (`Badge`), Occurred At

### Sensor Monitoring (`TelemetryPage`)

- Page header chip row: Room, Temp, Humidity, Motion, Flame, Gas — alert-state chips highlighted
- Featured Latest Reading panel: all fields of the most recent telemetry record, with alert highlighting for detected sensors
- Environmental Sensors tile grid: five tiles with inline SVG icons (Thermometer, Drop, Radar, Flame, Warning)
- All Records table: Device, Room, Temp (°C), Humidity (%), Motion, Flame, Gas, Recorded At
- No charts or external charting libraries; data shown as plain formatted values

### Command Override Center (`OverridesPage`)

- Ops stats row in page header: Pending / Executed / Failed+Blocked / Total Requests, color-coded
- FilterBar: All / requested / executed / failed / blocked
- Overrides table: Override ID, Device, Requested By, Actuator, Action, Reason, Status (`Badge`), Requested At, Result At
- Command panel with two sections side by side:
  - **Quick Actions**: Buzzer Off, Buzzer On, Door Unlock preset buttons that populate the form
  - **Issue Command Override form**: Device ID, Actuator ID, Action (dropdown), Reason, Submit button with inline result message

### Login and Profile Polish

- `LoginPage`: branded shield SVG, "Smart Home Security" headline, "Security Operations Portal" subtitle, styled email/password form, inline error display
- `ProfilePage` ("Account Identity"): large avatar initial circle, role badge, field grid (Email, Role, User ID, Account Status), read-only

## Build Verification

Admin web build passed:

```
cd admin-web
npm run build
```

Backend regression passed:

```
cd backend
npm run test:backend
```

Expected backend regression output: All backend regression checks passed.

## Current State

The admin web is functionally complete and visually polished. All pages are connected to real backend APIs. The UI uses only built-in CSS and inline SVGs — no external UI component libraries or charting libraries were added.

All admin-web work is frontend-only. No backend code was modified. Deployment to AWS EC2 has not been completed yet. There is no real-time streaming; all data is fetched on page load or on filter change.

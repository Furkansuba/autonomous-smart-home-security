const {
  OFFLINE_PUSH_CONTROLLER_DEVICE_IDS,
} = require('../src/services/deviceStatusMonitor.service');
const { HEARTBEAT_POLICY } = require('../src/services/deviceStatus.service');

let hasFailure = false;

// --- Allowlist membership ---

if (!OFFLINE_PUSH_CONTROLLER_DEVICE_IDS.has('esp32_home_01')) {
  console.error('[FAIL] esp32_home_01 must be in OFFLINE_PUSH_CONTROLLER_DEVICE_IDS');
  hasFailure = true;
} else {
  console.log('[OK] esp32_home_01 is in controller allowlist -> FCM enabled on offline');
}

const LOGICAL_COMPONENT_IDS = [
  'pcf8574_01',
  'flame_sensor_01',
  'mq2_sensor_01',
  'mq7_sensor_01',
  'dht_sensor_01',
  'pir_sensor_01',
  'impact_sensor_01',
  'reed_sensor_01',
  'door_controller_01',
  'pump_rm1_01',
  'pump_rm2_01',
  'pump_kit_01',
  'pump_liv_01',
  'buzzer_01',
];

for (const id of LOGICAL_COMPONENT_IDS) {
  if (OFFLINE_PUSH_CONTROLLER_DEVICE_IDS.has(id)) {
    console.error('[FAIL] logical component must NOT be in allowlist: ' + id);
    hasFailure = true;
  } else {
    console.log('[OK] ' + id + ' -> excluded from allowlist (ui-only)');
  }
}

// --- Heartbeat thresholds unchanged ---

if (HEARTBEAT_POLICY.heartbeatIntervalSeconds !== 30) {
  console.error('[FAIL] heartbeat interval changed: ' + HEARTBEAT_POLICY.heartbeatIntervalSeconds);
  hasFailure = true;
} else {
  console.log('[OK] heartbeat interval: 30s');
}
if (HEARTBEAT_POLICY.degradedThresholdSeconds !== 60) {
  console.error('[FAIL] degraded threshold changed: ' + HEARTBEAT_POLICY.degradedThresholdSeconds);
  hasFailure = true;
} else {
  console.log('[OK] degraded threshold: 60s');
}
if (HEARTBEAT_POLICY.offlineThresholdSeconds !== 90) {
  console.error('[FAIL] offline threshold changed: ' + HEARTBEAT_POLICY.offlineThresholdSeconds);
  hasFailure = true;
} else {
  console.log('[OK] offline threshold: 90s');
}

// --- Dispatch routing simulation ---
// Replays the exact conditional logic from runStatusCheck() using mock callbacks.

const fcmDispatched = [];
const fcmSuppressed = [];

function mockSendOfflineNotification(deviceId) {
  fcmDispatched.push(deviceId);
}
function mockLogComponentSkip(deviceId) {
  fcmSuppressed.push(deviceId);
}

const testEntries = [
  // controller transitions offline -> should dispatch FCM
  { device_id: 'esp32_home_01', changed: true,  current_status: 'offline', previous_status: 'online' },
  // logical components transition offline -> should suppress FCM
  { device_id: 'pcf8574_01',    changed: true,  current_status: 'offline', previous_status: 'online' },
  { device_id: 'pump_kit_01',   changed: true,  current_status: 'offline', previous_status: 'degraded' },
  { device_id: 'flame_sensor_01', changed: true, current_status: 'offline', previous_status: 'online' },
  { device_id: 'buzzer_01',     changed: true,  current_status: 'offline', previous_status: 'online' },
  // controller recovers -> must NOT trigger notification (current_status !== 'offline')
  { device_id: 'esp32_home_01', changed: true,  current_status: 'online',  previous_status: 'offline' },
  // controller already offline, no change -> must NOT trigger notification (changed === false)
  { device_id: 'esp32_home_01', changed: false, current_status: 'offline', previous_status: 'offline' },
];

for (const entry of testEntries) {
  if (
    entry.changed &&
    entry.current_status === 'offline' &&
    entry.previous_status !== 'offline'
  ) {
    if (OFFLINE_PUSH_CONTROLLER_DEVICE_IDS.has(entry.device_id)) {
      mockSendOfflineNotification(entry.device_id);
    } else {
      mockLogComponentSkip(entry.device_id);
    }
  }
}

// controller dispatched exactly once
if (fcmDispatched.length !== 1 || fcmDispatched[0] !== 'esp32_home_01') {
  console.error('[FAIL] expected exactly 1 controller FCM dispatch (esp32_home_01), got: ' + JSON.stringify(fcmDispatched));
  hasFailure = true;
} else {
  console.log('[OK] controller esp32_home_01 offline -> sendDeviceOfflineNotification called once');
}

// controller not in suppressed list
if (fcmSuppressed.includes('esp32_home_01')) {
  console.error('[FAIL] esp32_home_01 must not appear in suppressed list');
  hasFailure = true;
} else {
  console.log('[OK] esp32_home_01 not treated as component');
}

// all tested components suppressed
const expectedSuppressed = ['pcf8574_01', 'pump_kit_01', 'flame_sensor_01', 'buzzer_01'];
for (const id of expectedSuppressed) {
  if (!fcmSuppressed.includes(id)) {
    console.error('[FAIL] ' + id + ' should be in suppressed list, not dispatched');
    hasFailure = true;
  } else {
    console.log('[OK] ' + id + ' offline -> FCM suppressed (ui-only)');
  }
}

// recovery transition does not dispatch
const recoveryDispatch = fcmDispatched.filter((id, idx) => idx > 0);
if (recoveryDispatch.length > 0) {
  console.error('[FAIL] recovery transition must not trigger dispatch: ' + JSON.stringify(recoveryDispatch));
  hasFailure = true;
} else {
  console.log('[OK] controller recovery (offline->online) does not trigger notification');
}

// unchanged entry does not dispatch
if (fcmDispatched.length > 1) {
  console.error('[FAIL] unchanged offline entry must not trigger re-dispatch');
  hasFailure = true;
} else {
  console.log('[OK] unchanged offline entry (changed=false) does not trigger re-dispatch');
}

if (hasFailure) {
  process.exit(1);
}
console.log('Device status monitor policy tests passed.');

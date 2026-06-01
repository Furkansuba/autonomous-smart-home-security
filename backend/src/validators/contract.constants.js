const ROLES = ['admin', 'resident'];
const ROOM_IDS = [
  'kitchen',
  'living_room',
  'bedroom_1',
  'bedroom_2',
  'garage',
  'hallway',
  'main_door',
];
const DEVICE_STATUSES = ['online', 'degraded', 'offline'];
const EVENT_TYPES = [
  'fire_detected',
  'gas_detected',
  'co_detected',
  'intrusion_detected',
  'vibration_detected',
  'motion_detected',
  'reed_switch_opened',
  'door_access_granted',
  'door_access_denied',
  'door_unlock_requested',
  'door_unlocked',
  'device_online',
  'device_offline',
  'heartbeat_missed',
  'manual_override_requested',
  'manual_override_executed',
  'manual_override_failed',
  'system_reset',
  'alarm_triggered',
  'alarm_silenced',
];
const SEVERITY_LEVELS = ['info', 'warning', 'critical'];
const ACCESS_METHODS = ['nfc', 'app'];
const ACCESS_RESULTS = ['granted', 'denied'];
const OVERRIDE_RESULTS = ['executed', 'failed', 'blocked'];
const OVERRIDE_ACTIONS = [
  'pump_on',
  'pump_off',
  'valve_open',
  'valve_close',
  'buzzer_on',
  'buzzer_off',
  'door_unlock',
  'system_reset',
];
module.exports = {
  ROLES,
  ROOM_IDS,
  DEVICE_STATUSES,
  EVENT_TYPES,
  SEVERITY_LEVELS,
  ACCESS_METHODS,
  ACCESS_RESULTS,
  OVERRIDE_RESULTS,
  OVERRIDE_ACTIONS,
};

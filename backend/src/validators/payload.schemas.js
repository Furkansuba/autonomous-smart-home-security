const { z } = require('zod');
const {
  ROOM_IDS,
  DEVICE_STATUSES,
  EVENT_TYPES,
  SEVERITY_LEVELS,
  ACCESS_METHODS,
  ACCESS_RESULTS,
  OVERRIDE_RESULTS,
  OVERRIDE_ACTIONS,
} = require('./contract.constants');
const isoTimestamp = z
  .string()
  .datetime({ offset: true })
  .describe('UTC ISO-8601 timestamp');
const deviceId = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9_]+_[0-9]+$/);
const heartbeatSchema = z.object({
  device_id: deviceId,
  status: z.enum(DEVICE_STATUSES),
  firmware_version: z.string().min(1).max(30),
  uptime_seconds: z.number().int().nonnegative(),
  wifi_rssi: z.number().int().min(-120).max(0),
  security_armed: z.boolean().optional(),
  door_locked: z.boolean().optional(),
  timestamp: isoTimestamp,
});
const telemetrySchema = z.object({
  device_id: deviceId,
  room_id: z.enum(ROOM_IDS),
  temperature_c: z.number().min(-20).max(100).optional(),
  humidity_percent: z.number().min(0).max(100).optional(),
  gas_raw: z.number().int().min(0).max(4095).optional(),
  co_raw: z.number().int().min(0).max(4095).optional(),
  flame_detected: z.boolean().optional(),
  motion_detected: z.boolean().optional(),
  reed_open: z.boolean().optional(),
  timestamp: isoTimestamp,
});
const eventSchema = z.object({
  event_id: z.string().min(3).max(80),
  device_id: deviceId,
  room_id: z.enum(ROOM_IDS),
  event_type: z.enum(EVENT_TYPES),
  severity: z.enum(SEVERITY_LEVELS),
  message: z.string().min(1).max(240),
  sensor_id: z.string().min(1).max(80).optional(),
  raw_value: z.union([z.number(), z.string(), z.boolean()]).optional(),
  confirmed: z.boolean().default(true),
  timestamp: isoTimestamp,
});
const accessSchema = z.object({
  access_id: z.string().min(3).max(80),
  device_id: deviceId,
  gate_id: z.string().min(1).max(80),
  user_id: z.string().min(1).max(80).optional(),
  access_method: z.enum(ACCESS_METHODS),
  result: z.enum(ACCESS_RESULTS),
  card_uid_hash: z.string().min(1).max(160).optional(),
  timestamp: isoTimestamp,
});
const overrideRequestSchema = z.object({
  override_id: z.string().min(3).max(80),
  device_id: deviceId,
  requested_by: z.string().min(1).max(80),
  actuator_id: z.string().min(1).max(80),
  action: z.enum(OVERRIDE_ACTIONS),
  reason: z.string().min(1).max(240).optional(),
  timestamp: isoTimestamp,
});
const overrideResultSchema = z.object({
  override_id: z.string().min(3).max(80),
  device_id: deviceId,
  actuator_id: z.string().min(1).max(80),
  action: z.enum(OVERRIDE_ACTIONS),
  result: z.enum(OVERRIDE_RESULTS),
  blocked_reason: z.string().max(240).nullable().optional(),
  timestamp: isoTimestamp,
});
function validatePayload(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return {
    valid: true,
    data: result.data,
  };
}
module.exports = {
  heartbeatSchema,
  telemetrySchema,
  eventSchema,
  accessSchema,
  overrideRequestSchema,
  overrideResultSchema,
  validatePayload,
};

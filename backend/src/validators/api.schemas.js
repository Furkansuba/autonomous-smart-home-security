const { z } = require('zod');
const {
  OVERRIDE_ACTIONS,
} = require('./contract.constants');
const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const createOverrideBodySchema = z.object({
  override_id: z.string().min(1).optional(),
  device_id: z.string().min(1),
  requested_by: z.string().min(1),
  actuator_id: z.string().min(1),
  action: z.enum(OVERRIDE_ACTIONS),
  reason: z.string().min(1).optional(),
});
module.exports = {
  loginBodySchema,
  createOverrideBodySchema,
};

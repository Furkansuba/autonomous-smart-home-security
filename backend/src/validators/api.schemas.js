const { z } = require('zod');
const {
  OVERRIDE_ACTIONS,
} = require('./contract.constants');
const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const registerBodySchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100)
    .trim()
    .regex(/\p{L}/u, 'Full name must include at least one letter'),
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  admin_key: z.string().min(1).optional(),
  // .strict() ensures any extra fields (e.g. role) are rejected outright
}).strict();
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
  registerBodySchema,
  createOverrideBodySchema,
};

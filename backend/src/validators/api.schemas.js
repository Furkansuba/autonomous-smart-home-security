const { z } = require('zod');
const {
  OVERRIDE_ACTIONS,
  SECURITY_QUESTION_OPTIONS,
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
  security_question: z.enum(SECURITY_QUESTION_OPTIONS).optional(),
  security_answer:   z.string().min(1).max(500).optional(),
  // .strict() ensures any extra fields (e.g. role) are rejected outright
}).strict().refine(
  (data) => {
    const hasQ = Boolean(data.security_question);
    const hasA = Boolean(data.security_answer);
    return hasQ === hasA;
  },
  {
    message: 'security_question and security_answer must both be provided or both omitted.',
    path: ['security_question'],
  }
);

const recoveryQuestionBodySchema = z.object({
  email: z.string().email(),
}).strict();

const recoveryResetBodySchema = z.object({
  email: z.string().email(),
  security_answer: z.string().min(1),
  new_password: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'New password must contain at least one digit'),
}).strict();

const createOverrideBodySchema = z.object({
  override_id: z.string().min(1).optional(),
  device_id: z.string().min(1),
  requested_by: z.string().min(1),
  actuator_id: z.string().min(1),
  action: z.enum(OVERRIDE_ACTIONS),
  reason: z.string().min(1).optional(),
});

// Promotion-only — demotion deferred; any role other than 'admin' is rejected at schema level
const updateRoleBodySchema = z.object({
  role: z.enum(['admin']),
}).strict();

module.exports = {
  loginBodySchema,
  registerBodySchema,
  recoveryQuestionBodySchema,
  recoveryResetBodySchema,
  createOverrideBodySchema,
  updateRoleBodySchema,
  SECURITY_QUESTION_OPTIONS,
};

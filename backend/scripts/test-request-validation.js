const { z } = require('zod');
const { validateBody } = require('../src/middleware/validateRequest');
const {
  loginBodySchema,
  createOverrideBodySchema,
} = require('../src/validators/api.schemas');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
function runMiddleware(middleware, req, res) {
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return nextCalled;
}
function main() {
  const validLoginReq = {
    body: {
      email: 'admin@smarthome.local',
      password: 'Admin123!',
    },
  };
  const validLoginRes = createMockRes();
  const validLoginNext = runMiddleware(
    validateBody(loginBodySchema),
    validLoginReq,
    validLoginRes
  );
  assert(validLoginNext === true, 'valid login body should pass validation');
  console.log('[OK] valid login body accepted');
  const invalidLoginReq = {
    body: {
      email: 'not-an-email',
      password: '',
    },
  };
  const invalidLoginRes = createMockRes();
  const invalidLoginNext = runMiddleware(
    validateBody(loginBodySchema),
    invalidLoginReq,
    invalidLoginRes
  );
  assert(invalidLoginNext === false, 'invalid login body should not call next');
  assert(invalidLoginRes.statusCode === 400, 'invalid login body should return 400');
  assert(Array.isArray(invalidLoginRes.body.issues), 'invalid response should include issues');
  console.log('[OK] invalid login body rejected');
  const validOverrideReq = {
    body: {
      device_id: 'esp32_home_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'buzzer_off',
      reason: 'Validation test.',
    },
  };
  const validOverrideRes = createMockRes();
  const validOverrideNext = runMiddleware(
    validateBody(createOverrideBodySchema),
    validOverrideReq,
    validOverrideRes
  );
  assert(validOverrideNext === true, 'valid override body should pass validation');
  console.log('[OK] valid override body accepted');
  const invalidOverrideReq = {
    body: {
      device_id: 'esp32_home_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'invalid_action',
    },
  };
  const invalidOverrideRes = createMockRes();
  const invalidOverrideNext = runMiddleware(
    validateBody(createOverrideBodySchema),
    invalidOverrideReq,
    invalidOverrideRes
  );
  assert(invalidOverrideNext === false, 'invalid override body should not call next');
  assert(invalidOverrideRes.statusCode === 400, 'invalid override body should return 400');
  console.log('[OK] invalid override body rejected');
  console.log('REST request validation tests passed.');
}
try {
  main();
} catch (error) {
  console.error('[FAIL] REST request validation test failed');
  console.error(error);
  process.exit(1);
}

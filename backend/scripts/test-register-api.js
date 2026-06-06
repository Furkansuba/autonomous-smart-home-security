/**
 * Registration API tests.
 * Follows the same pattern as test-auth-api.js — plain Node.js, no external test runner.
 * Requires a live MongoDB connection.
 */
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { User, AdminKey } = require('../src/models');
const { registerUser } = require('../src/controllers/auth.controller');

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function callRegister(body) {
  // Mirrors what validateBody(registerBodySchema) does — call controller directly with parsed body
  const req = { body };
  const res = createMockRes();
  await registerUser(req, res);
  return res;
}

async function main() {
  const db = await connectDatabase();
  if (!db.connected) {
    console.error('MongoDB connection required.');
    process.exit(1);
  }

  const run = String(Date.now());
  // Emails used in tests — cleaned up in finally block
  const emails = {
    resident: `reg_resident_${run}@smarthome.local`,
    admin:    `reg_admin_${run}@smarthome.local`,
    dup:      `reg_dup_${run}@smarthome.local`,
  };
  // Temp demo key seeded for these tests only
  const TEST_PLAIN_KEY = `TEST-KEY-${run}`;
  let testKeyId = null;

  try {
    // ── Seed a fresh test admin key ──────────────────────────────────────────
    const testKeyDoc = await AdminKey.create({
      key_hash: AdminKey.hashKey(TEST_PLAIN_KEY),
      device_id: 'esp32_home_01',
    });
    testKeyId = testKeyDoc._id;
    console.log('[SETUP] Test admin key seeded');

    // ── 1. Register resident (no admin_key) ──────────────────────────────────
    {
      const res = await callRegister({
        full_name: 'Demo Resident',
        email: emails.resident,
        password: 'Resident123!',
      });
      assert(res.statusCode === 201, `resident register: expected 201, got ${res.statusCode}`);
      assert(res.body.authenticated === true, 'resident: authenticated should be true');
      assert(Boolean(res.body.token), 'resident: token should be present');
      assert(res.body.user.role === 'resident', `resident: role should be resident, got ${res.body.user.role}`);
      assert(res.body.user.email === emails.resident, 'resident: email mismatch');
      assert(!res.body.user.password_hash, 'resident: password_hash must not be in response');
      console.log('[OK] 1. Register resident (no key) → 201 role=resident');
    }

    // ── 2. Register admin with valid unused key ───────────────────────────────
    {
      const res = await callRegister({
        full_name: 'Demo Admin',
        email: emails.admin,
        password: 'Admin123!',
        admin_key: TEST_PLAIN_KEY,
      });
      assert(res.statusCode === 201, `admin register: expected 201, got ${res.statusCode}`);
      assert(res.body.user.role === 'admin', `admin: role should be admin, got ${res.body.user.role}`);
      console.log('[OK] 2. Register admin with valid key → 201 role=admin');
    }

    // ── 3. Admin key cannot be reused (single-use) ───────────────────────────
    {
      const res = await callRegister({
        full_name: 'Second Admin Attempt',
        email: `reg_admin2_${run}@smarthome.local`,
        password: 'Admin123!',
        admin_key: TEST_PLAIN_KEY,
      });
      assert(res.statusCode === 400, `reuse key: expected 400, got ${res.statusCode}`);
      assert(/already been used/i.test(res.body.error), `reuse key: unexpected error "${res.body.error}"`);
      console.log('[OK] 3. Admin key cannot be reused → 400');
    }

    // ── 4. Invalid admin key ─────────────────────────────────────────────────
    {
      const res = await callRegister({
        full_name: 'Bad Key User',
        email: `reg_badkey_${run}@smarthome.local`,
        password: 'Valid123!',
        admin_key: 'WRONG-KEY-DOES-NOT-EXIST',
      });
      assert(res.statusCode === 400, `invalid key: expected 400, got ${res.statusCode}`);
      assert(/invalid registration key/i.test(res.body.error), `invalid key: unexpected error "${res.body.error}"`);
      console.log('[OK] 4. Invalid admin key → 400');
    }

    // ── 5. Duplicate email ───────────────────────────────────────────────────
    {
      await callRegister({ full_name: 'First', email: emails.dup, password: 'Valid123!' });
      const res = await callRegister({ full_name: 'Second', email: emails.dup, password: 'Valid123!' });
      assert(res.statusCode === 409, `dup email: expected 409, got ${res.statusCode}`);
      assert(/already registered/i.test(res.body.error), `dup email: unexpected error "${res.body.error}"`);
      console.log('[OK] 5. Duplicate email → 409');
    }

    // ── 6. Weak password (too short) ─────────────────────────────────────────
    // Note: schema validation happens in middleware; calling controller directly
    // bypasses validateBody. We test the schema separately here.
    {
      const { registerBodySchema } = require('../src/validators/api.schemas');
      const result = registerBodySchema.safeParse({
        full_name: 'Test',
        email: 'weak@smarthome.local',
        password: 'short',
      });
      assert(!result.success, 'weak password: schema should reject');
      const hasPasswordIssue = result.error.issues.some((i) => i.path.includes('password'));
      assert(hasPasswordIssue, 'weak password: issue should reference password field');
      console.log('[OK] 6. Weak password (<8 chars) → schema rejects → 400 via middleware');
    }

    // ── 7. Missing required field (no full_name) ──────────────────────────────
    {
      const { registerBodySchema } = require('../src/validators/api.schemas');
      const result = registerBodySchema.safeParse({
        email: 'noname@smarthome.local',
        password: 'Valid123!',
      });
      assert(!result.success, 'missing full_name: schema should reject');
      const hasFnIssue = result.error.issues.some((i) => i.path.includes('full_name'));
      assert(hasFnIssue, 'missing full_name: issue should reference full_name field');
      console.log('[OK] 7. Missing full_name → schema rejects → 400 via middleware');
    }

    // ── 8. Client supplies role field — rejected by strict schema ─────────────
    {
      const { registerBodySchema } = require('../src/validators/api.schemas');
      const result = registerBodySchema.safeParse({
        full_name: 'Role Injector',
        email: 'inject@smarthome.local',
        password: 'Valid123!',
        role: 'admin',                  // extra field the client should not send
      });
      assert(!result.success, 'role injection: schema should reject extra field');
      const hasRoleIssue = result.error.issues.some(
        (i) => i.code === 'unrecognized_keys' || (i.keys && i.keys.includes('role'))
      );
      assert(hasRoleIssue, 'role injection: Zod should flag unrecognized key "role"');
      console.log('[OK] 8. Client-supplied role field → schema strict rejects → 400 via middleware');
    }

    // ── 9. Password missing uppercase — schema rejects ────────────────────────
    {
      const { registerBodySchema } = require('../src/validators/api.schemas');
      const result = registerBodySchema.safeParse({
        full_name: 'Test',
        email: 'nocase@smarthome.local',
        password: 'alllower1',
      });
      assert(!result.success, 'no-uppercase password: schema should reject');
      console.log('[OK] 9. Password without uppercase → schema rejects → 400 via middleware');
    }

    console.log('\nAll registration tests passed.');
  } finally {
    // Clean up all test users and the test admin key
    await User.deleteMany({ email: { $in: Object.values(emails) } });
    await User.deleteMany({ email: { $regex: `_${run}@smarthome\\.local$` } });
    if (testKeyId) await AdminKey.findByIdAndDelete(testKeyId);
    // Also clean up any admin key that was used by test
    await AdminKey.deleteMany({ used_by: { $regex: /^usr_/ }, createdAt: { $gte: new Date(Date.now() - 60000) } });
    await disconnectDatabase();
  }
}

main().catch(async (err) => {
  console.error('[FAIL]', err.message);
  await disconnectDatabase();
  process.exit(1);
});

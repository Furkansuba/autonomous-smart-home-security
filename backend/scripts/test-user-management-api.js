/**
 * User management API tests.
 * Tests GET /api/users (list) and PATCH /api/users/:user_id/role (promote).
 * Requires a live MongoDB connection.
 */
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { User } = require('../src/models');
const {
  hashPassword,
  signAuthToken,
} = require('../src/auth/auth.service');
const {
  authenticate,
  requireRole,
} = require('../src/auth/auth.middleware');
const {
  listUsers,
  updateUserRole,
} = require('../src/controllers/users.controller');
const {
  updateRoleBodySchema,
} = require('../src/validators/api.schemas');

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

async function runMiddleware(middleware, req, res) {
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return nextCalled;
}

async function main() {
  const db = await connectDatabase();
  if (!db.connected) {
    console.error('MongoDB connection required.');
    process.exit(1);
  }

  const run = String(Date.now());
  const adminData = {
    user_id: `usr_um_admin_${run}`,
    email: `um_admin_${run}@smarthome.local`,
    full_name: 'UM Admin',
    role: 'admin',
    is_active: true,
  };
  const residentData = {
    user_id: `usr_um_resident_${run}`,
    email: `um_resident_${run}@smarthome.local`,
    full_name: 'UM Resident',
    role: 'resident',
    is_active: true,
  };

  try {
    const pwHash = await hashPassword('UMTest123!');
    await User.create([
      { ...adminData, password_hash: pwHash },
      { ...residentData, password_hash: pwHash },
    ]);
    console.log('[SETUP] Test users seeded');

    const adminToken = signAuthToken(adminData);
    const residentToken = signAuthToken(residentData);

    // ── 1. No token GET /api/users → 401 ────────────────────────────────────
    {
      const res = createMockRes();
      const passed = await runMiddleware(authenticate, { headers: {} }, res);
      assert(!passed, '1: no token should not call next');
      assert(res.statusCode === 401, `1: expected 401, got ${res.statusCode}`);
      console.log('[OK] 1. No token GET /api/users → 401');
    }

    // ── 2. Resident GET /api/users → 403 ────────────────────────────────────
    {
      const req = { headers: { authorization: `Bearer ${residentToken}` } };
      const authPassed = await runMiddleware(authenticate, req, createMockRes());
      assert(authPassed, '2: resident authenticate should pass');
      const roleRes = createMockRes();
      const rolePassed = await runMiddleware(requireRole('admin'), req, roleRes);
      assert(!rolePassed, '2: resident should not pass admin role check');
      assert(roleRes.statusCode === 403, `2: expected 403, got ${roleRes.statusCode}`);
      console.log('[OK] 2. Resident GET /api/users → 403');
    }

    // ── 3. Admin GET /api/users → 200 ───────────────────────────────────────
    {
      const req = { user: adminData };
      const res = createMockRes();
      await listUsers(req, res);
      assert(res.statusCode === 200, `3: expected 200, got ${res.statusCode}`);
      assert(Array.isArray(res.body.users), '3: body.users must be array');
      const testEntry = res.body.users.find(u => u.user_id === adminData.user_id);
      assert(testEntry, '3: admin test user should appear in list');
      console.log(`[OK] 3. Admin GET /api/users → 200 (${res.body.users.length} users)`);
    }

    // ── 4. Response excludes password_hash ───────────────────────────────────
    {
      const req = { user: adminData };
      const res = createMockRes();
      await listUsers(req, res);
      const anyLeak = res.body.users.some(u => 'password_hash' in u);
      assert(!anyLeak, '4: password_hash must not appear in any user object');
      console.log('[OK] 4. GET /api/users response excludes password_hash');
    }

    // ── 5. Response excludes fcm_token ───────────────────────────────────────
    {
      const req = { user: adminData };
      const res = createMockRes();
      await listUsers(req, res);
      const anyLeak = res.body.users.some(u => 'fcm_token' in u);
      assert(!anyLeak, '5: fcm_token must not appear in any user object');
      console.log('[OK] 5. GET /api/users response excludes fcm_token');
    }

    // ── 6. No token PATCH /:user_id/role → 401 ──────────────────────────────
    {
      const res = createMockRes();
      const passed = await runMiddleware(authenticate, { headers: {} }, res);
      assert(!passed, '6: no token should not call next');
      assert(res.statusCode === 401, `6: expected 401, got ${res.statusCode}`);
      console.log('[OK] 6. No token PATCH /:user_id/role → 401');
    }

    // ── 7. Resident PATCH /:user_id/role → 403 ──────────────────────────────
    {
      const req = { headers: { authorization: `Bearer ${residentToken}` } };
      await runMiddleware(authenticate, req, createMockRes());
      const roleRes = createMockRes();
      const passed = await runMiddleware(requireRole('admin'), req, roleRes);
      assert(!passed, '7: resident should not pass admin role check');
      assert(roleRes.statusCode === 403, `7: expected 403, got ${roleRes.statusCode}`);
      console.log('[OK] 7. Resident PATCH /:user_id/role → 403');
    }

    // ── 8. Admin promotes resident → admin → 200 role=admin ─────────────────
    {
      const req = {
        user: adminData,
        params: { user_id: residentData.user_id },
        body: { role: 'admin' },
      };
      const res = createMockRes();
      await updateUserRole(req, res);
      assert(res.statusCode === 200, `8: expected 200, got ${res.statusCode}`);
      assert(res.body.user.role === 'admin', `8: role should be admin, got ${res.body.user.role}`);
      assert(res.body.user.user_id === residentData.user_id, '8: user_id should match');
      assert(!('password_hash' in res.body.user), '8: password_hash must not be in response');
      assert(!('fcm_token' in res.body.user), '8: fcm_token must not be in response');
      console.log('[OK] 8. Admin promotes resident → admin → 200 role=admin');
    }

    // ── 9. Admin promotes already-admin → 200 idempotent ────────────────────
    {
      const req = {
        user: adminData,
        params: { user_id: adminData.user_id },
        body: { role: 'admin' },
      };
      const res = createMockRes();
      await updateUserRole(req, res);
      assert(res.statusCode === 200, `9: expected 200, got ${res.statusCode}`);
      assert(res.body.user.role === 'admin', '9: role should still be admin');
      assert(res.body.user.user_id === adminData.user_id, '9: user_id should match');
      console.log('[OK] 9. Admin promotes already-admin → 200 idempotent');
    }

    // ── 10. Invalid role body → schema rejects → 400 via middleware ──────────
    {
      const invalid1 = updateRoleBodySchema.safeParse({ role: 'resident' });
      assert(!invalid1.success, '10: role=resident should fail schema');
      const invalid2 = updateRoleBodySchema.safeParse({ role: 'superadmin' });
      assert(!invalid2.success, '10: role=superadmin should fail schema');
      const invalid3 = updateRoleBodySchema.safeParse({ role: 'admin', extra: 'field' });
      assert(!invalid3.success, '10: extra fields should be rejected by strict schema');
      const valid = updateRoleBodySchema.safeParse({ role: 'admin' });
      assert(valid.success, '10: role=admin should pass schema');
      console.log('[OK] 10. Invalid role body → schema rejects → 400 via middleware');
    }

    // ── 11. Non-existent user_id → 404 ──────────────────────────────────────
    {
      const req = {
        user: adminData,
        params: { user_id: 'usr_does_not_exist_zzz999' },
        body: { role: 'admin' },
      };
      const res = createMockRes();
      await updateUserRole(req, res);
      assert(res.statusCode === 404, `11: expected 404, got ${res.statusCode}`);
      assert(/not found/i.test(res.body.error), `11: error should say not found, got "${res.body.error}"`);
      console.log('[OK] 11. Non-existent user_id → 404');
    }

    console.log('\nAll user management tests passed.');
  } finally {
    await User.deleteMany({
      user_id: { $in: [adminData.user_id, residentData.user_id] },
    });
    await disconnectDatabase();
  }
}

main().catch(async (err) => {
  console.error('[FAIL]', err.message);
  await disconnectDatabase();
  process.exit(1);
});

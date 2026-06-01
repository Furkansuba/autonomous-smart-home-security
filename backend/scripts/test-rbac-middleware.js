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
async function runMiddleware(middleware, req, res) {
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return nextCalled;
}
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for RBAC test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = String(Date.now());
  const admin = {
    user_id: 'usr_rbac_admin_' + runId,
    email: 'rbac_admin_' + runId + '@smarthome.local',
    full_name: 'RBAC Admin',
    role: 'admin',
    is_active: true,
  };
  const resident = {
    user_id: 'usr_rbac_resident_' + runId,
    email: 'rbac_resident_' + runId + '@smarthome.local',
    full_name: 'RBAC Resident',
    role: 'resident',
    is_active: true,
  };
  try {
    const passwordHash = await hashPassword('RbacTest123!');
    await User.create([
      {
        ...admin,
        password_hash: passwordHash,
      },
      {
        ...resident,
        password_hash: passwordHash,
      },
    ]);
    const missingTokenReq = {
      headers: {},
    };
    const missingTokenRes = createMockRes();
    const missingTokenNext = await runMiddleware(
      authenticate,
      missingTokenReq,
      missingTokenRes
    );
    assert(missingTokenNext === false, 'missing token should not call next');
    assert(missingTokenRes.statusCode === 401, 'missing token should return 401');
    console.log('[OK] missing bearer token rejected');
    const adminToken = signAuthToken(admin);
    const adminReq = {
      headers: {
        authorization: 'Bearer ' + adminToken,
      },
    };
    const adminRes = createMockRes();
    const adminAuthNext = await runMiddleware(authenticate, adminReq, adminRes);
    assert(adminAuthNext === true, 'admin token should authenticate');
    assert(adminReq.user.role === 'admin', 'admin user should be attached');
    const adminRoleRes = createMockRes();
    const adminRoleNext = await runMiddleware(
      requireRole('admin'),
      adminReq,
      adminRoleRes
    );
    assert(adminRoleNext === true, 'admin should pass admin role check');
    console.log('[OK] admin token authenticated and authorized');
    const residentToken = signAuthToken(resident);
    const residentReq = {
      headers: {
        authorization: 'Bearer ' + residentToken,
      },
    };
    const residentRes = createMockRes();
    const residentAuthNext = await runMiddleware(
      authenticate,
      residentReq,
      residentRes
    );
    assert(residentAuthNext === true, 'resident token should authenticate');
    assert(residentReq.user.role === 'resident', 'resident user should be attached');
    const residentRoleRes = createMockRes();
    const residentRoleNext = await runMiddleware(
      requireRole('admin'),
      residentReq,
      residentRoleRes
    );
    assert(residentRoleNext === false, 'resident should fail admin role check');
    assert(residentRoleRes.statusCode === 403, 'resident should receive 403');
    console.log('[OK] resident rejected by admin role check');
    console.log('RBAC middleware tests passed.');
  } finally {
    await User.deleteMany({
      user_id: {
        $in: [admin.user_id, resident.user_id],
      },
    });
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] RBAC middleware test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});

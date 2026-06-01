const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { User } = require('../src/models');
const { hashPassword } = require('../src/auth/auth.service');
const {
  loginUser,
  getCurrentUser,
} = require('../src/controllers/auth.controller');
const {
  authenticate,
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
    console.error('MongoDB connection is required for auth API test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = String(Date.now());
  const email = 'auth_test_' + runId + '@smarthome.local';
  const userId = 'usr_auth_test_' + runId;
  try {
    await User.deleteMany({ email });
    const passwordHash = await hashPassword('AuthTest123!');
    await User.create({
      user_id: userId,
      email,
      password_hash: passwordHash,
      full_name: 'Auth Test User',
      role: 'admin',
      is_active: true,
    });
    const loginReq = {
      body: {
        email,
        password: 'AuthTest123!',
      },
    };
    const loginRes = createMockRes();
    await loginUser(loginReq, loginRes);
    assert(loginRes.statusCode === 200, 'login should return 200');
    assert(loginRes.body.authenticated === true, 'login should authenticate');
    assert(Boolean(loginRes.body.token), 'login should return token');
    assert(loginRes.body.user.email === email, 'login should return safe user');
    console.log('[OK] loginUser controller');
    const meReq = {
      headers: {
        authorization: 'Bearer ' + loginRes.body.token,
      },
    };
    const meRes = createMockRes();
    const nextCalled = await runMiddleware(authenticate, meReq, meRes);
    assert(nextCalled === true, 'authenticate middleware should call next');
    assert(meReq.user.email === email, 'authenticate should attach user');
    await getCurrentUser(meReq, meRes);
    assert(meRes.statusCode === 200, 'getCurrentUser should return 200');
    assert(meRes.body.authenticated === true, 'getCurrentUser should be authenticated');
    assert(meRes.body.user.email === email, 'getCurrentUser should return current user');
    console.log('[OK] authenticate middleware');
    console.log('[OK] getCurrentUser controller');
    console.log('Auth API tests passed.');
  } finally {
    await User.deleteMany({ email });
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] auth API test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});

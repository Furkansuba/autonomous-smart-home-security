const {
  notFoundHandler,
  errorHandler,
} = require('../src/middleware/errorHandlers');
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
function main() {
  const notFoundReq = {
    originalUrl: '/unknown/path',
  };
  const notFoundRes = createMockRes();
  notFoundHandler(notFoundReq, notFoundRes, () => {});
  assert(notFoundRes.statusCode === 404, 'notFoundHandler should return 404');
  assert(notFoundRes.body.error === 'Not Found', 'notFoundHandler should return Not Found');
  assert(notFoundRes.body.path === '/unknown/path', 'notFoundHandler should include path');
  console.log('[OK] notFoundHandler');
  const error = new Error('Test internal failure');
  error.statusCode = 418;
  error.publicMessage = 'Test public error';
  const errorReq = {};
  const errorRes = createMockRes();
  errorHandler(error, errorReq, errorRes, () => {});
  assert(errorRes.statusCode === 418, 'errorHandler should use custom statusCode');
  assert(errorRes.body.error === 'Test public error', 'errorHandler should use publicMessage');
  console.log('[OK] errorHandler custom status');
  const defaultError = new Error('Unexpected failure');
  const defaultRes = createMockRes();
  errorHandler(defaultError, {}, defaultRes, () => {});
  assert(defaultRes.statusCode === 500, 'errorHandler should default to 500');
  assert(defaultRes.body.error === 'Internal Server Error', 'errorHandler should default error text');
  console.log('[OK] errorHandler default status');
  console.log('Central error handler tests passed.');
}
try {
  main();
} catch (error) {
  console.error('[FAIL] central error handler test failed');
  console.error(error);
  process.exit(1);
}

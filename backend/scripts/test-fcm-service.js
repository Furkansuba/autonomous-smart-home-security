// Set env before any require so env.js picks it up before dotenv can override
process.env.FCM_ENABLED = 'false';
process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = '';

const { sendToToken, getFcmStatus } = require('../src/services/fcm.service');

function assert(condition, message) {
  if (!condition) throw new Error('ASSERT FAILED: ' + message);
}

async function main() {
  const status = getFcmStatus();
  assert(status.enabled === false, 'FCM should be disabled when FCM_ENABLED=false');
  assert(status.initialized === false, 'FCM should not be initialized when disabled');
  console.log('[OK] getFcmStatus returns disabled/uninitialized');

  const resultDisabled = await sendToToken('fake_device_token_abc123', 'Test Title', 'Test body');
  assert(resultDisabled.sent === false, 'sendToToken should not send when FCM is disabled');
  assert(resultDisabled.skipped === true, 'sendToToken should be skipped when FCM is disabled');
  assert(resultDisabled.reason === 'fcm_not_enabled', 'reason should be fcm_not_enabled');
  console.log('[OK] sendToToken skips gracefully when FCM is disabled');

  const resultNullToken = await sendToToken(null, 'Test', 'Body');
  assert(resultNullToken.sent === false, 'null token should not send');
  assert(resultNullToken.skipped === true, 'null token should be skipped');
  console.log('[OK] sendToToken handles null token safely');

  const resultEmptyToken = await sendToToken('   ', 'Test', 'Body');
  assert(resultEmptyToken.sent === false, 'empty token should not send');
  assert(resultEmptyToken.skipped === true, 'empty token should be skipped');
  console.log('[OK] sendToToken handles empty/whitespace token safely');

  console.log('FCM service tests passed.');
}

main().catch((error) => {
  console.error('[FAIL] FCM service test failed');
  console.error(error.message);
  process.exit(1);
});

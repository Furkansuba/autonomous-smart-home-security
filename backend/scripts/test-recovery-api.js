/**
 * Recovery API tests — security question + password reset flow.
 * Requires a live MongoDB connection.
 */
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { User } = require('../src/models');
const { verifyPassword } = require('../src/auth/auth.service');
const {
  registerUser,
  loginUser,
  getRecoveryQuestion,
  resetPassword,
} = require('../src/controllers/auth.controller');
const {
  registerBodySchema,
  recoveryResetBodySchema,
  SECURITY_QUESTION_OPTIONS,
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

async function call(fn, body) {
  const req = { body };
  const res = createMockRes();
  await fn(req, res);
  return res;
}

async function main() {
  const db = await connectDatabase();
  if (!db.connected) {
    console.error('MongoDB connection required.');
    process.exit(1);
  }

  const run = String(Date.now());
  const emails = {
    withRecovery: `rcv_with_${run}@smarthome.local`,
    noRecovery:   `rcv_none_${run}@smarthome.local`,
    resetTarget:  `rcv_reset_${run}@smarthome.local`,
    normTest:     `rcv_norm_${run}@smarthome.local`,
  };

  try {

    // ── 1. Register with security question + answer → 201 ─────────────────────
    let registerWithRecoveryRes;
    {
      registerWithRecoveryRes = await call(registerUser, {
        full_name: 'Recovery User',
        email: emails.withRecovery,
        password: 'Valid123!',
        security_question: 'What is the name of your first pet?',
        security_answer: 'fluffy',
      });
      assert(registerWithRecoveryRes.statusCode === 201, `1: expected 201, got ${registerWithRecoveryRes.statusCode} — ${JSON.stringify(registerWithRecoveryRes.body)}`);
      assert(registerWithRecoveryRes.body.authenticated === true, '1: should be authenticated');
      console.log('[OK] 1. Register with security question + answer → 201');
    }

    // ── 2. DB stores question/hash, not plaintext; neither leaks via API ───────
    {
      // API response must never expose recovery fields
      assert(!registerWithRecoveryRes.body.user.security_question,    '2: security_question must not be in register response');
      assert(!registerWithRecoveryRes.body.user.security_answer_hash, '2: security_answer_hash must not be in register response');
      // DB stores the question text and a bcrypt hash — not the plaintext answer
      const stored = await User.findOne({ email: emails.withRecovery })
        .select('+security_question +security_answer_hash');
      assert(stored.security_question === 'What is the name of your first pet?', '2: security_question not stored correctly');
      assert(Boolean(stored.security_answer_hash),              '2: security_answer_hash not stored');
      assert(stored.security_answer_hash !== 'fluffy',          '2: plaintext answer must not be stored');
      const answerOk = await verifyPassword('fluffy', stored.security_answer_hash);
      assert(answerOk, '2: stored hash must verify against original answer');
      console.log('[OK] 2. DB stores security_question + security_answer_hash (not plaintext)');
    }

    // ── 3. Register without security question → 201, fields null ──────────────
    {
      const res = await call(registerUser, {
        full_name: 'No Recovery User',
        email: emails.noRecovery,
        password: 'Valid123!',
      });
      assert(res.statusCode === 201, `3: expected 201, got ${res.statusCode}`);
      assert(!res.body.user.security_question,    '3: security_question must not be in response');
      assert(!res.body.user.security_answer_hash, '3: security_answer_hash must not be in response');
      const stored = await User.findOne({ email: emails.noRecovery })
        .select('+security_question +security_answer_hash');
      assert(stored.security_question    == null, '3: security_question should be null in DB');
      assert(stored.security_answer_hash == null, '3: security_answer_hash should be null in DB');
      console.log('[OK] 3. Register without security question → 201, recovery fields null');
    }

    // ── 4. Register with question but no answer → schema rejects ──────────────
    {
      const result = registerBodySchema.safeParse({
        full_name: 'Test User',
        email: `rcv_q_only_${run}@smarthome.local`,
        password: 'Valid123!',
        security_question: 'What is the name of your first pet?',
        // security_answer absent → refine should fail
      });
      assert(!result.success, '4: schema should reject question without answer');
      const hasIssue = result.error.issues.some((i) =>
        i.path.includes('security_question') || i.message.includes('security_question')
      );
      assert(hasIssue, '4: refine issue should reference security_question path');
      console.log('[OK] 4. Register with question but no answer → schema rejects → 400 via middleware');
    }

    // ── 5. Register with answer but no question → schema rejects ──────────────
    {
      const result = registerBodySchema.safeParse({
        full_name: 'Test User',
        email: `rcv_a_only_${run}@smarthome.local`,
        password: 'Valid123!',
        security_answer: 'some answer',
        // security_question absent → refine should fail
      });
      assert(!result.success, '5: schema should reject answer without question');
      const hasIssue = result.error.issues.some((i) =>
        i.path.includes('security_question') || i.message.includes('security_question')
      );
      assert(hasIssue, '5: refine issue should reference security_question path');
      console.log('[OK] 5. Register with answer but no question → schema rejects → 400 via middleware');
    }

    // ── 6. recovery/question — configured account ──────────────────────────────
    {
      const res = await call(getRecoveryQuestion, { email: emails.withRecovery });
      assert(res.statusCode === 200, `6: expected 200, got ${res.statusCode}`);
      assert(res.body.configured === true, '6: configured should be true');
      assert(res.body.question === 'What is the name of your first pet?', '6: wrong question returned');
      assert(!res.body.security_answer_hash, '6: must not expose answer hash');
      console.log('[OK] 6. recovery/question configured account → 200 configured:true + question');
    }

    // ── 7. recovery/question — unconfigured account ────────────────────────────
    {
      const res = await call(getRecoveryQuestion, { email: emails.noRecovery });
      assert(res.statusCode === 200,        '7: expected 200');
      assert(res.body.configured === false, '7: configured should be false');
      assert(res.body.question   === null,  '7: question should be null');
      console.log('[OK] 7. recovery/question unconfigured account → 200 configured:false');
    }

    // ── 8. recovery/question — nonexistent email ───────────────────────────────
    {
      const res = await call(getRecoveryQuestion, { email: `ghost_${run}@smarthome.local` });
      assert(res.statusCode === 200,        '8: expected 200');
      assert(res.body.configured === false, '8: configured should be false');
      assert(res.body.question   === null,  '8: question should be null');
      console.log('[OK] 8. recovery/question nonexistent email → 200 configured:false');
    }

    // ── Setup for tests 9-12: register a user with recovery ───────────────────
    {
      const res = await call(registerUser, {
        full_name: 'Reset Target',
        email: emails.resetTarget,
        password: 'OldPass123!',
        security_question: 'What city were you born in?',
        security_answer: 'ankara',
      });
      assert(res.statusCode === 201, `setup 9-12: expected 201, got ${res.statusCode}`);
    }

    // ── 9. recovery/reset correct answer → 200 ────────────────────────────────
    {
      const res = await call(resetPassword, {
        email: emails.resetTarget,
        security_answer: 'ankara',
        new_password: 'NewPass456!',
      });
      assert(res.statusCode === 200,    `9: expected 200, got ${res.statusCode} — ${JSON.stringify(res.body)}`);
      assert(res.body.success === true, '9: success should be true');
      assert(res.body.message === 'Password updated. Please sign in.', '9: wrong message');
      assert(!res.body.token,           '9: token must not be returned on reset');
      console.log('[OK] 9. recovery/reset correct answer → 200 success');
    }

    // ── 10. Old password rejected after reset ─────────────────────────────────
    {
      const res = await call(loginUser, { email: emails.resetTarget, password: 'OldPass123!' });
      assert(res.statusCode === 401, `10: expected 401, got ${res.statusCode}`);
      console.log('[OK] 10. Old password rejected after reset → 401');
    }

    // ── 11. New password accepted after reset ─────────────────────────────────
    {
      const res = await call(loginUser, { email: emails.resetTarget, password: 'NewPass456!' });
      assert(res.statusCode === 200,          `11: expected 200, got ${res.statusCode}`);
      assert(res.body.authenticated === true, '11: should be authenticated');
      assert(res.body.user.email === emails.resetTarget, '11: email mismatch');
      console.log('[OK] 11. New password accepted after reset → 200');
    }

    // ── 12. recovery/reset wrong answer → 400 ────────────────────────────────
    {
      const res = await call(resetPassword, {
        email: emails.resetTarget,
        security_answer: 'wronganswer',
        new_password: 'AnyPass123!',
      });
      assert(res.statusCode === 400, `12: expected 400, got ${res.statusCode}`);
      assert(/incorrect security answer/i.test(res.body.error), `12: wrong error: "${res.body.error}"`);
      console.log('[OK] 12. recovery/reset wrong answer → 400');
    }

    // ── 13. recovery/reset weak new_password → schema rejects ────────────────
    {
      const result = recoveryResetBodySchema.safeParse({
        email: emails.resetTarget,
        security_answer: 'ankara',
        new_password: 'weak',
      });
      assert(!result.success, '13: schema should reject weak new_password');
      const hasPwIssue = result.error.issues.some((i) => i.path.includes('new_password'));
      assert(hasPwIssue, '13: issue should reference new_password field');
      console.log('[OK] 13. recovery/reset weak new_password → schema rejects → 400 via middleware');
    }

    // ── 14. Answer normalization: "  New   York " matches "new york" ──────────
    {
      await call(registerUser, {
        full_name: 'Norm Test User',
        email: emails.normTest,
        password: 'Valid123!',
        security_question: 'What city were you born in?',
        security_answer: 'new york',
      });
      const res = await call(resetPassword, {
        email: emails.normTest,
        security_answer: '  New   York ',   // extra spaces + uppercase
        new_password: 'NewNorm123!',
      });
      assert(res.statusCode === 200,    `14: expected 200, got ${res.statusCode} — ${JSON.stringify(res.body)}`);
      assert(res.body.success === true, '14: normalization should allow reset with extra spaces/casing');
      console.log('[OK] 14. Answer normalization: "  New   York " matches "new york"');
    }

    // ── 15. Valid question from allowed list passes schema ────────────────────
    {
      const validQuestion = SECURITY_QUESTION_OPTIONS[4]; // "What is your mother's maiden name?"
      const result = registerBodySchema.safeParse({
        full_name: 'Test User',
        email: `rcv_valid_q_${run}@smarthome.local`,
        password: 'Valid123!',
        security_question: validQuestion,
        security_answer: 'smith',
      });
      assert(result.success, `15: schema should accept valid question "${validQuestion}", errors: ${JSON.stringify(result.error?.issues)}`);
      console.log('[OK] 15. Valid question from allowed list → schema accepts');
    }

    // ── 16. Custom question not in allowed list → schema rejects ──────────────
    {
      const result = registerBodySchema.safeParse({
        full_name: 'Test User',
        email: `rcv_bad_q_${run}@smarthome.local`,
        password: 'Valid123!',
        security_question: 'What is your favorite color?', // not in allowed list
        security_answer: 'blue',
      });
      assert(!result.success, '16: schema should reject custom question not in allowed list');
      const hasQIssue = result.error.issues.some((i) => i.path.includes('security_question'));
      assert(hasQIssue, '16: issue should reference security_question field');
      console.log('[OK] 16. Custom question not in allowed list → schema rejects → 400 via middleware');
    }

    console.log('\nAll recovery API tests passed.');

  } finally {
    await User.deleteMany({ email: { $in: Object.values(emails) } });
    await disconnectDatabase();
  }
}

main().catch(async (err) => {
  console.error('[FAIL]', err.message);
  await disconnectDatabase();
  process.exit(1);
});

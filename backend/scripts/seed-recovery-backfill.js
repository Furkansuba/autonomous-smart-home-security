/**
 * Recovery backfill for demo accounts.
 * Sets security_question and hashed security_answer_hash for core demo users.
 *
 * By default, skips any account that already has recovery configured.
 * Set FORCE_RECOVERY_BACKFILL=true to overwrite existing recovery data.
 *
 * Required environment variables (do NOT commit these values):
 *   DEMO_ADMIN_RECOVERY_QUESTION    — must be one of the allowed question options
 *   DEMO_ADMIN_RECOVERY_ANSWER
 *   DEMO_RESIDENT_RECOVERY_QUESTION — must be one of the allowed question options
 *   DEMO_RESIDENT_RECOVERY_ANSWER
 *
 * Optional:
 *   FORCE_RECOVERY_BACKFILL=true   — overwrite existing recovery fields
 *
 * Usage:
 *   DEMO_ADMIN_RECOVERY_QUESTION="What city were you born in?" \
 *   DEMO_ADMIN_RECOVERY_ANSWER="<answer>" \
 *   DEMO_RESIDENT_RECOVERY_QUESTION="What is the name of your first pet?" \
 *   DEMO_RESIDENT_RECOVERY_ANSWER="<answer>" \
 *   node scripts/seed-recovery-backfill.js
 */
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { User } = require('../src/models');
const { hashPassword } = require('../src/auth/auth.service');
const { SECURITY_QUESTION_OPTIONS } = require('../src/validators/api.schemas');

function normalizeAnswer(answer) {
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function backfillAccount(email, question, plainAnswer, force) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail })
    .select('+security_question +security_answer_hash');

  if (!existing) {
    console.log(`[SKIP] Account not found in DB: ${email}`);
    return false;
  }

  if (existing.security_question && existing.security_answer_hash && !force) {
    console.log(`[SKIP] Recovery already configured for: ${email} (use FORCE_RECOVERY_BACKFILL=true to overwrite)`);
    return false;
  }

  const normalizedAnswer = normalizeAnswer(plainAnswer);
  const answerHash = await hashPassword(normalizedAnswer);

  await User.updateOne(
    { email: normalizedEmail },
    { $set: { security_question: question, security_answer_hash: answerHash } }
  );

  const action = (existing.security_question && existing.security_answer_hash) ? 'Overwritten' : 'Configured';
  console.log(`[OK]   ${action}: ${email}`);
  console.log(`       Question: ${question}`);
  // plainAnswer is intentionally not logged
  return true;
}

async function main() {
  const adminQ    = process.env.DEMO_ADMIN_RECOVERY_QUESTION;
  const adminA    = process.env.DEMO_ADMIN_RECOVERY_ANSWER;
  const residentQ = process.env.DEMO_RESIDENT_RECOVERY_QUESTION;
  const residentA = process.env.DEMO_RESIDENT_RECOVERY_ANSWER;
  const force     = process.env.FORCE_RECOVERY_BACKFILL === 'true';

  // ── Validate env vars present ──────────────────────────────────────────────
  const missing = [];
  if (!adminQ)    missing.push('DEMO_ADMIN_RECOVERY_QUESTION');
  if (!adminA)    missing.push('DEMO_ADMIN_RECOVERY_ANSWER');
  if (!residentQ) missing.push('DEMO_RESIDENT_RECOVERY_QUESTION');
  if (!residentA) missing.push('DEMO_RESIDENT_RECOVERY_ANSWER');

  if (missing.length > 0) {
    console.error('[ERROR] Missing required environment variables:');
    missing.forEach((v) => console.error('  ' + v));
    console.error('');
    console.error('Allowed questions:');
    SECURITY_QUESTION_OPTIONS.forEach((q, i) => console.error(`  ${i + 1}. ${q}`));
    console.error('');
    console.error('Example:');
    console.error('  DEMO_ADMIN_RECOVERY_QUESTION="What city were you born in?" \\');
    console.error('  DEMO_ADMIN_RECOVERY_ANSWER="<answer>" \\');
    console.error('  DEMO_RESIDENT_RECOVERY_QUESTION="What is the name of your first pet?" \\');
    console.error('  DEMO_RESIDENT_RECOVERY_ANSWER="<answer>" \\');
    console.error('  node scripts/seed-recovery-backfill.js');
    process.exit(1);
  }

  // ── Validate questions are from the allowed list ───────────────────────────
  const invalidQuestions = [];
  if (!SECURITY_QUESTION_OPTIONS.includes(adminQ)) {
    invalidQuestions.push(`DEMO_ADMIN_RECOVERY_QUESTION: "${adminQ}"`);
  }
  if (!SECURITY_QUESTION_OPTIONS.includes(residentQ)) {
    invalidQuestions.push(`DEMO_RESIDENT_RECOVERY_QUESTION: "${residentQ}"`);
  }

  if (invalidQuestions.length > 0) {
    console.error('[ERROR] Provided questions are not in the allowed list:');
    invalidQuestions.forEach((q) => console.error('  ' + q));
    console.error('');
    console.error('Allowed questions:');
    SECURITY_QUESTION_OPTIONS.forEach((q, i) => console.error(`  ${i + 1}. ${q}`));
    process.exit(1);
  }

  // ── Connect and run ────────────────────────────────────────────────────────
  const db = await connectDatabase();
  if (!db.connected) {
    console.error('[ERROR] MongoDB connection required.');
    process.exit(1);
  }

  try {
    if (force) {
      console.log('FORCE_RECOVERY_BACKFILL=true — existing recovery data will be overwritten.');
    }
    console.log('Starting recovery backfill for demo accounts...');

    await backfillAccount('admin@smarthome.local',    adminQ, adminA,    force);
    await backfillAccount('resident@smarthome.local', residentQ, residentA, force);

    console.log('');
    console.log('Backfill complete.');
    console.log('Do not commit plaintext answers. Store them only in your secure demo notes.');
  } finally {
    await disconnectDatabase();
  }
}

main().catch(async (err) => {
  console.error('[FAIL]', err.message);
  await disconnectDatabase();
  process.exit(1);
});

const { env } = require('../config/env');

let client = null;
let isInitialized = false;

function maskPhone(num) {
  if (!num || num.length < 4) return '***';
  return num.slice(0, 3) + '****' + num.slice(-2);
}

function initTwilio() {
  if (!env.smsEnabled) {
    return;
  }
  if (
    !env.twilioAccountSid ||
    !env.twilioAuthToken ||
    !env.twilioFromNumber ||
    !env.smsAlertTo
  ) {
    console.warn(
      '[SMS] SMS_ENABLED=true but one or more required vars are missing ' +
        '(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, SMS_ALERT_TO). SMS disabled.'
    );
    return;
  }
  try {
    const twilio = require('twilio');
    client = twilio(env.twilioAccountSid, env.twilioAuthToken);
    isInitialized = true;
    console.log('[SMS] Twilio client initialized. Alert recipient configured.');
  } catch (error) {
    console.error('[SMS] Twilio initialization failed: ' + error.message);
  }
}

initTwilio();

async function sendSmsToNumber(to, body) {
  if (!isInitialized) {
    return { sent: false, skipped: true, reason: 'sms_not_configured' };
  }
  if (!to || to.trim().length === 0) {
    return { sent: false, skipped: true, reason: 'sms_no_recipient' };
  }
  try {
    await client.messages.create({
      from: env.twilioFromNumber,
      to: to.trim(),
      body,
    });
    return { sent: true, skipped: false };
  } catch (error) {
    console.error('[SMS] Send to ' + maskPhone(to) + ' failed: ' + error.message);
    return { sent: false, skipped: false, error: error.message };
  }
}

function getSmsStatus() {
  return {
    enabled: env.smsEnabled,
    initialized: isInitialized,
  };
}

module.exports = {
  sendSmsToNumber,
  getSmsStatus,
};

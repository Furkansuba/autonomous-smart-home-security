const admin = require('firebase-admin');
const { env } = require('../config/env');

let isInitialized = false;

function initFirebase() {
  if (!env.fcmEnabled) {
    return;
  }
  if (!env.firebaseServiceAccountBase64) {
    console.warn('[FCM] FCM_ENABLED=true but FIREBASE_SERVICE_ACCOUNT_BASE64 is not set. FCM disabled.');
    return;
  }
  try {
    const serviceAccount = JSON.parse(
      Buffer.from(env.firebaseServiceAccountBase64, 'base64').toString('utf-8')
    );
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    isInitialized = true;
    console.log('[FCM] Firebase Admin SDK initialized.');
  } catch (error) {
    console.error('[FCM] Firebase Admin initialization failed: ' + error.message);
  }
}

initFirebase();

async function sendToToken(fcmToken, title, body, data = {}) {
  if (!isInitialized) {
    return { sent: false, skipped: true, reason: 'fcm_not_enabled' };
  }
  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
    return { sent: false, skipped: true, reason: 'invalid_token' };
  }
  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = String(v);
  }
  try {
    await admin.messaging().send({
      token: fcmToken.trim(),
      notification: { title, body },
      data: { ...stringData, title, body },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'critical_alerts',
        },
      },
    });
    return { sent: true, skipped: false };
  } catch (error) {
    return { sent: false, skipped: false, error: error.message };
  }
}

function getFcmStatus() {
  return {
    enabled: env.fcmEnabled,
    initialized: isInitialized,
  };
}

module.exports = {
  sendToToken,
  getFcmStatus,
};

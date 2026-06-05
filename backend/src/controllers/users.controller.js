const { User } = require('../models');
const { getDatabaseStatus } = require('../config/database');

function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}

async function registerFcmToken(req, res) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }
  const { fcm_token } = req.body;
  if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim().length === 0) {
    return res.status(400).json({ error: 'fcm_token is required and must be a non-empty string.' });
  }
  try {
    await User.findOneAndUpdate(
      { user_id: req.user.user_id },
      { $set: { fcm_token: fcm_token.trim() } }
    );
    return res.status(200).json({ updated: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to register FCM token.', message: error.message });
  }
}

module.exports = { registerFcmToken };

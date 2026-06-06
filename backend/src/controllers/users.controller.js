const { User } = require('../models');
const { getDatabaseStatus } = require('../config/database');

function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}

// Whitelist projection: excludes _id, password_hash (select:false on model), fcm_token, __v
const USER_SAFE_FIELDS = '-_id user_id full_name email role is_active createdAt updatedAt';

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

async function listUsers(req, res) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }
  try {
    const users = await User.find({})
      .select(USER_SAFE_FIELDS)
      .lean()
      .sort({ createdAt: 1 });
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to list users.', message: error.message });
  }
}

async function updateUserRole(req, res) {
  if (!isDatabaseConnected()) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }
  const { user_id } = req.params;
  const { role } = req.body;
  try {
    const updated = await User.findOneAndUpdate(
      { user_id },
      { $set: { role } },
      { returnDocument: 'after' }
    ).select(USER_SAFE_FIELDS).lean();
    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json({ user: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user role.', message: error.message });
  }
}

module.exports = { registerFcmToken, listUsers, updateUserRole };

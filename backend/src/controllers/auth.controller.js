const crypto = require('crypto');
const { User, AdminKey } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
  hashPassword,
  verifyPassword,
  signAuthToken,
  toSafeUser,
} = require('../auth/auth.service');
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}
async function loginUser(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required.',
    });
  }
  try {
    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      is_active: true,
    }).select('+password_hash');
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }
    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }
    user.last_login_at = new Date();
    await user.save();
    const token = signAuthToken(user);
    return res.status(200).json({
      authenticated: true,
      token,
      token_type: 'Bearer',
      expires_in: '1d',
      user: toSafeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Login failed.',
      message: error.message,
    });
  }
}
async function getCurrentUser(req, res) {
  return res.status(200).json({
    authenticated: true,
    user: req.user,
  });
}
async function registerUser(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  // role is NOT accepted from the request body — schema.strict() rejects it at validation stage
  const { full_name, email, password, admin_key } = req.body;
  const normalizedEmail = String(email).toLowerCase().trim();

  // Generate user_id before any DB writes so it can be referenced in key consumption + rollback
  const user_id = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  let assignedRole = 'resident';
  let consumedKeyHash = null; // tracks whether we atomically claimed a key this request

  try {
    // Duplicate email check — fast reject before touching admin key inventory
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    if (admin_key) {
      const keyHash = AdminKey.hashKey(admin_key);

      // Atomic claim: flips is_used only if currently false, binding it to this user_id.
      // Returns the pre-update document (or null if no match) — null means nothing was claimed.
      const claimed = await AdminKey.findOneAndUpdate(
        { key_hash: keyHash, is_used: false },
        { $set: { is_used: true, used_by: user_id, used_at: new Date() } }
      );

      if (!claimed) {
        // Distinguish "already used" from "never existed" for a clear error message
        const exists = await AdminKey.exists({ key_hash: keyHash });
        if (exists) {
          return res.status(400).json({ error: 'Registration key has already been used.' });
        }
        return res.status(400).json({ error: 'Invalid registration key.' });
      }

      assignedRole = 'admin';
      consumedKeyHash = keyHash; // remember in case User.create fails and we must rollback
    }

    const password_hash = await hashPassword(password);

    const newUser = await User.create({
      user_id,
      email: normalizedEmail,
      password_hash,
      full_name: String(full_name).trim(),
      role: assignedRole,
      is_active: true,
    });

    const token = signAuthToken(newUser);
    return res.status(201).json({
      authenticated: true,
      token,
      token_type: 'Bearer',
      expires_in: '1d',
      user: toSafeUser(newUser),
    });
  } catch (error) {
    // If user creation failed after the key was atomically consumed, release it so it can be retried
    if (consumedKeyHash) {
      await AdminKey.findOneAndUpdate(
        { key_hash: consumedKeyHash, used_by: user_id },
        { $set: { is_used: false, used_by: null, used_at: null } }
      ).catch(() => {}); // best-effort rollback; log in production
    }
    return res.status(500).json({
      error: 'Registration failed.',
      message: error.message,
    });
  }
}

module.exports = {
  loginUser,
  getCurrentUser,
  registerUser,
};

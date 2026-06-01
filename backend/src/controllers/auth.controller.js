const { User } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
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
module.exports = {
  loginUser,
  getCurrentUser,
};

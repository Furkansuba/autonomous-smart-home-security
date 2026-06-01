const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const PASSWORD_SALT_ROUNDS = 10;
async function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}
async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
function toSafeUser(userInput) {
  const user = userInput && typeof userInput.toObject === 'function'
    ? userInput.toObject()
    : userInput;
  if (!user) {
    return null;
  }
  return {
    user_id: user.user_id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    last_login_at: user.last_login_at || null,
  };
}
function signAuthToken(userInput) {
  if (!env.jwtSecret || env.jwtSecret === 'change_this_secret') {
    console.warn('[AUTH] JWT_SECRET should be changed before production use.');
  }
  const user = userInput && typeof userInput.toObject === 'function'
    ? userInput.toObject()
    : userInput;
  return jwt.sign(
    {
      sub: user.user_id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret || 'development_secret',
    {
      expiresIn: env.jwtExpiresIn || '1d',
    }
  );
}
function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret || 'development_secret');
}
module.exports = {
  hashPassword,
  verifyPassword,
  toSafeUser,
  signAuthToken,
  verifyAuthToken,
};

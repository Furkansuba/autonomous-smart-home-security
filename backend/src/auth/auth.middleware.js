const { User } = require('../models');
const { verifyAuthToken, toSafeUser } = require('./auth.service');
function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim();
}
async function authenticate(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Missing bearer token.',
    });
  }
  try {
    const decoded = verifyAuthToken(token);
    const user = await User.findOne({
      user_id: decoded.sub,
      is_active: true,
    });
    if (!user) {
      return res.status(401).json({
        error: 'User not found or inactive.',
      });
    }
    req.auth = decoded;
    req.user = toSafeUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid or expired token.',
      message: error.message,
    });
  }
}
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden.',
        required_roles: roles,
        current_role: req.user.role,
      });
    }
    return next();
  };
}
module.exports = {
  getBearerToken,
  authenticate,
  requireRole,
};

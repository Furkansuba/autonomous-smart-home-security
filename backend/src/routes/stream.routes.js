const express = require('express');
const { User } = require('../models');
const { verifyAuthToken, toSafeUser } = require('../auth/auth.service');
const { getBearerToken } = require('../auth/auth.middleware');
const { streamEvents } = require('../controllers/stream.controller');

const router = express.Router();

// SSE auth: the browser EventSource API cannot set an Authorization header, so the
// JWT is accepted from the ?token= query string (header is still accepted as a
// fallback for non-browser clients). Any authenticated user (admin or resident) may
// subscribe — the stream only carries non-sensitive activity summaries.
async function authenticateStream(req, res, next) {
  const token = (req.query && req.query.token) || getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing token.' });
  }
  try {
    const decoded = verifyAuthToken(token);
    const user = await User.findOne({ user_id: decoded.sub, is_active: true });
    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive.' });
    }
    req.auth = decoded;
    req.user = toSafeUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

router.get('/', authenticateStream, streamEvents);

module.exports = router;

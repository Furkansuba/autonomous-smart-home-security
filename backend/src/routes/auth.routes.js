const express = require('express');
const {
  loginUser,
  getCurrentUser,
} = require('../controllers/auth.controller');
const {
  authenticate,
} = require('../auth/auth.middleware');
const router = express.Router();
router.post('/login', loginUser);
router.get('/me', authenticate, getCurrentUser);
module.exports = router;

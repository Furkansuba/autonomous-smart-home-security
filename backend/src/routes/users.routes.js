const express = require('express');
const { registerFcmToken } = require('../controllers/users.controller');
const { authenticate } = require('../auth/auth.middleware');

const router = express.Router();

router.post('/fcm-token', authenticate, registerFcmToken);

module.exports = router;

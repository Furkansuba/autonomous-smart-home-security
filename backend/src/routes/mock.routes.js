const express = require('express');
const {
  ingestMockMqttMessage,
} = require('../controllers/mockMqtt.controller');
const {
  authenticate,
  requireRole,
} = require('../auth/auth.middleware');
const router = express.Router();
router.post('/mqtt', authenticate, requireRole('admin'), ingestMockMqttMessage);
module.exports = router;

const express = require('express');
const {
  ingestMockMqttMessage,
} = require('../controllers/mockMqtt.controller');
const router = express.Router();
router.post('/mqtt', ingestMockMqttMessage);
module.exports = router;

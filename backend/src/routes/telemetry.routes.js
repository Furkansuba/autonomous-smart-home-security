const express = require('express');
const {
  listTelemetry,
  getLatestTelemetry,
} = require('../controllers/telemetry.controller');
const router = express.Router();
router.get('/', listTelemetry);
router.get('/latest', getLatestTelemetry);
module.exports = router;

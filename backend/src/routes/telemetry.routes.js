const express = require('express');
const {
  listTelemetry,
  getLatestTelemetry,
  getActiveHazards,
} = require('../controllers/telemetry.controller');
const router = express.Router();
router.get('/', listTelemetry);
router.get('/latest', getLatestTelemetry);
router.get('/hazards', getActiveHazards);
module.exports = router;

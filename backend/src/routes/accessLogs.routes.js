const express = require('express');
const {
  listAccessLogs,
  getAccessLogById,
} = require('../controllers/accessLogs.controller');
const router = express.Router();
router.get('/', listAccessLogs);
router.get('/:accessId', getAccessLogById);
module.exports = router;

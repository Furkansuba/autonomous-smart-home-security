const express = require('express');
const {
  listNotificationLogs,
} = require('../controllers/notificationLogs.controller');
const {
  authenticate,
  requireRole,
} = require('../auth/auth.middleware');
const router = express.Router();
router.get('/', authenticate, requireRole('admin'), listNotificationLogs);
module.exports = router;

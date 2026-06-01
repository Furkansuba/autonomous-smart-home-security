const express = require('express');
const {
  listDevices,
  getDeviceById,
  refreshDeviceStatuses,
} = require('../controllers/devices.controller');
const {
  authenticate,
  requireRole,
} = require('../auth/auth.middleware');
const router = express.Router();
router.get('/', listDevices);
router.post('/refresh-status', authenticate, requireRole('admin'), refreshDeviceStatuses);
router.get('/:deviceId', getDeviceById);
module.exports = router;

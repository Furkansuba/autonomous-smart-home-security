const express = require('express');
const {
  listDevices,
  getDeviceById,
  refreshDeviceStatuses,
} = require('../controllers/devices.controller');
const {
  getDeviceComponents,
} = require('../controllers/deviceComponents.controller');
const {
  authenticate,
  requireRole,
} = require('../auth/auth.middleware');
const router = express.Router();
router.get('/', listDevices);
router.post('/refresh-status', authenticate, requireRole('admin'), refreshDeviceStatuses);
// Derived, read-only attached-component view for a single controller.
router.get('/:deviceId/components', getDeviceComponents);
router.get('/:deviceId', getDeviceById);
module.exports = router;

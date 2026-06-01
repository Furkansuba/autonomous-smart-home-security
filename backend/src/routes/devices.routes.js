const express = require('express');
const {
  listDevices,
  getDeviceById,
  refreshDeviceStatuses,
} = require('../controllers/devices.controller');
const router = express.Router();
router.get('/', listDevices);
router.post('/refresh-status', refreshDeviceStatuses);
router.get('/:deviceId', getDeviceById);
module.exports = router;

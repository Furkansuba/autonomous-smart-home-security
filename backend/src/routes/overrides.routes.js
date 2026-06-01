const express = require('express');
const {
  listOverrides,
  getOverrideById,
  createOverride,
} = require('../controllers/overrides.controller');
const {
  authenticate,
  requireRole,
} = require('../auth/auth.middleware');
const router = express.Router();
router.get('/', listOverrides);
router.post('/', authenticate, requireRole('admin'), createOverride);
router.get('/:overrideId', getOverrideById);
module.exports = router;

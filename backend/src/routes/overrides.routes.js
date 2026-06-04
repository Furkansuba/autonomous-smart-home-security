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
const {
  validateBody,
} = require('../middleware/validateRequest');
const {
  createOverrideBodySchema,
} = require('../validators/api.schemas');
const router = express.Router();
router.get('/', authenticate, listOverrides);
router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validateBody(createOverrideBodySchema),
  createOverride
);
router.get('/:overrideId', getOverrideById);
module.exports = router;

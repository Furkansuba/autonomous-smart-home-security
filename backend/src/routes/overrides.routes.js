const express = require('express');
const {
  listOverrides,
  getOverrideById,
  createOverride,
} = require('../controllers/overrides.controller');
const router = express.Router();
router.get('/', listOverrides);
router.post('/', createOverride);
router.get('/:overrideId', getOverrideById);
module.exports = router;

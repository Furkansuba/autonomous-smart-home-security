const express = require('express');
const {
  loginUser,
  getCurrentUser,
} = require('../controllers/auth.controller');
const {
  authenticate,
} = require('../auth/auth.middleware');
const {
  validateBody,
} = require('../middleware/validateRequest');
const {
  loginBodySchema,
} = require('../validators/api.schemas');
const router = express.Router();
router.post('/login', validateBody(loginBodySchema), loginUser);
router.get('/me', authenticate, getCurrentUser);
module.exports = router;

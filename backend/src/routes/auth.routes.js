const express = require('express');
const {
  loginUser,
  getCurrentUser,
  registerUser,
  getRecoveryQuestion,
  resetPassword,
} = require('../controllers/auth.controller');
const {
  authenticate,
} = require('../auth/auth.middleware');
const {
  validateBody,
} = require('../middleware/validateRequest');
const {
  loginBodySchema,
  registerBodySchema,
  recoveryQuestionBodySchema,
  recoveryResetBodySchema,
} = require('../validators/api.schemas');

const router = express.Router();

router.post('/login',             validateBody(loginBodySchema),             loginUser);
router.post('/register',          validateBody(registerBodySchema),          registerUser);
router.get('/me',                 authenticate,                              getCurrentUser);
router.post('/recovery/question', validateBody(recoveryQuestionBodySchema),  getRecoveryQuestion);
router.post('/recovery/reset',    validateBody(recoveryResetBodySchema),     resetPassword);

module.exports = router;

const express = require('express');
const { registerFcmToken, listUsers, updateUserRole } = require('../controllers/users.controller');
const { authenticate, requireRole } = require('../auth/auth.middleware');
const { validateBody } = require('../middleware/validateRequest');
const { updateRoleBodySchema } = require('../validators/api.schemas');

const router = express.Router();

router.post('/fcm-token', authenticate, registerFcmToken);
router.get('/', authenticate, requireRole('admin'), listUsers);
router.patch('/:user_id/role', authenticate, requireRole('admin'), validateBody(updateRoleBodySchema), updateUserRole);

module.exports = router;

const express = require('express');
const {
  getContractTypes,
  validateContractPayload,
} = require('../controllers/contractValidation.controller');
const router = express.Router();
router.get('/types', getContractTypes);
router.post('/validate', validateContractPayload);
module.exports = router;

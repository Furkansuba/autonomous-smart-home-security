const express = require('express');
const {
  listEvents,
  getEventById,
} = require('../controllers/events.controller');
const router = express.Router();
router.get('/', listEvents);
router.get('/:eventId', getEventById);
module.exports = router;

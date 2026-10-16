const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const bookingController = require('../controllers/booking.controller');
const authenticate = require('../middleware/authenticate');
const { validate, isUuid } = require('../middleware/validate');

const router = express.Router();
router.get('/:id/bookings', authenticate, validate((req) => (
  isUuid(req.params.id) ? null : 'user id must be a UUID'
)), asyncHandler(bookingController.userBookings));

module.exports = router;

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const showController = require('../controllers/show.controller');
const bookingController = require('../controllers/booking.controller');
const authenticate = require('../middleware/authenticate');
const { validate, isUuid } = require('../middleware/validate');

const router = express.Router();
router.get('/:id/seats', validate((req) => (
  isUuid(req.params.id) ? null : 'show id must be a UUID'
)), asyncHandler(showController.getSeats));

function validateSeatIds(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return 'JSON request body must be an object';
  if (!Array.isArray(req.body.seatIds) || req.body.seatIds.length === 0 || req.body.seatIds.some((id) => !isUuid(id))) {
    return 'seatIds must be a non-empty array of UUIDs';
  }
  if (new Set(req.body.seatIds).size !== req.body.seatIds.length) return 'seatIds must not contain duplicates';
  return null;
}

router.post('/:id/lock', authenticate, validate((req) => {
  if (!isUuid(req.params.id)) return 'show id must be a UUID';
  return validateSeatIds(req);
}), asyncHandler(bookingController.lockSeats));

router.post('/:id/unlock', authenticate, validate((req) => {
  if (!isUuid(req.params.id)) return 'show id must be a UUID';
  return validateSeatIds(req);
}), asyncHandler(bookingController.unlockSeats));

module.exports = router;

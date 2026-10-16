const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const bookingController = require('../controllers/booking.controller');
const authenticate = require('../middleware/authenticate');
const { validate, isUuid, requireObjectBody } = require('../middleware/validate');

const router = express.Router();
const validModes = new Set(['CARD', 'UPI', 'NET_BANKING']);

router.post('/', authenticate, validate((req) => {
  const bodyError = requireObjectBody(req);
  if (bodyError) return bodyError;
  if (!isUuid(req.body.showId)) return 'showId must be a UUID';
  if (!Array.isArray(req.body.seatIds) || req.body.seatIds.length === 0 || req.body.seatIds.some((id) => !isUuid(id))) {
    return 'seatIds must be a non-empty array of UUIDs';
  }
  if (new Set(req.body.seatIds).size !== req.body.seatIds.length) return 'seatIds must not contain duplicates';
  return null;
}), asyncHandler(bookingController.createBooking));

router.post('/:id/pay', authenticate, validate((req) => {
  if (!isUuid(req.params.id)) return 'booking id must be a UUID';
  const bodyError = requireObjectBody(req);
  if (bodyError) return bodyError;
  if (!validModes.has(req.body.mode)) return 'mode must be CARD, UPI, or NET_BANKING';
  return null;
}), asyncHandler(bookingController.pay));

router.post('/:id/cancel', authenticate, validate((req) => {
  if (!isUuid(req.params.id)) return 'booking id must be a UUID';
  if (req.body === undefined) return null;
  return requireObjectBody(req);
}), asyncHandler(bookingController.cancel));

module.exports = router;

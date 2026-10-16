const bookingService = require('../services/booking.service');

async function lockSeats(req, res) {
  res.json(await bookingService.lockSeats(req.params.id, req.body.seatIds, req.user.id));
}

async function unlockSeats(req, res) {
  res.json(await bookingService.unlockSeats(req.params.id, req.body.seatIds, req.user.id));
}

async function createBooking(req, res) {
  res.status(201).json(await bookingService.createBooking(req.body.showId, req.body.seatIds, req.user.id));
}

async function pay(req, res) {
  res.json(await bookingService.pay(req.params.id, req.body.mode, req.user.id));
}

async function cancel(req, res) {
  res.json(await bookingService.cancel(req.params.id, req.user.id));
}

async function userBookings(req, res) {
  if (req.params.id !== req.user.id) {
    const { HttpError } = require('../middleware/errorHandler');
    throw new HttpError(403, 'You may only access your own bookings');
  }
  res.json(await bookingService.getUserBookings(req.user.id));
}

module.exports = { lockSeats, unlockSeats, createBooking, pay, cancel, userBookings };

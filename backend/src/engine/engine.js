const path = require('node:path');

const addonPath = path.resolve(__dirname, '../../../core/build-node/Release/bookmyshow_addon.node');
const { BookingEngine: NativeBookingEngine } = require(addonPath);
const lockTtlSeconds = Number.parseInt(process.env.LOCK_TTL_SECONDS || '300', 10);
const nativeEngine = new NativeBookingEngine({
  lockTtlSeconds: Number.isInteger(lockTtlSeconds) && lockTtlSeconds > 0 ? lockTtlSeconds : 300,
});

function invoke(method, input = {}) {
  return JSON.parse(nativeEngine[method](JSON.stringify(input)));
}

module.exports = {
  loadShow: (show) => invoke('loadShow', show),
  getSeatMap: (showId) => invoke('getSeatMap', { showId }),
  lockSeats: (showId, seatIds, userId) => invoke('lockSeats', { showId, seatIds, userId }),
  unlockSeats: (showId, seatIds, userId) => invoke('unlockSeats', { showId, seatIds, userId }),
  createBooking: (showId, seatIds, userId) => invoke('createBooking', { showId, seatIds, userId }),
  pay: (bookingId, mode) => invoke('pay', { bookingId, mode }),
  cancel: (bookingId) => invoke('cancel', { bookingId }),
  quoteRefund: (showId, amount) => invoke('quoteRefund', { showId, amount }),
  releaseBookedSeats: (showId, seatIds) => invoke('releaseBookedSeats', { showId, seatIds }),
  releaseExpired: () => invoke('releaseExpired'),
};

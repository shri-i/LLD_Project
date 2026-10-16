const engine = require('../src/engine/engine');

function printResult(label, result) {
  console.log(`${label}: ${JSON.stringify(result)}`);
}

const showId = 'smoke-show-1';
const userId = 'smoke-user-1';
const seatIds = ['A1', 'A2'];

const loaded = engine.loadShow({
  showId,
  movieId: 'smoke-movie-1',
  screenId: 'smoke-screen-1',
  startTime: '2026-10-17T19:00:00Z',
  basePrice: 250,
  seats: [
    { seatId: 'A1', row: 'A', number: 1, type: 'REGULAR', status: 'AVAILABLE' },
    { seatId: 'A2', row: 'A', number: 2, type: 'PREMIUM', status: 'AVAILABLE' },
  ],
});
printResult('loadShow', loaded);
if (!loaded.ok) process.exit(1);

const locked = engine.lockSeats(showId, seatIds, userId);
printResult('lockSeats', locked);
if (!locked.ok) process.exit(1);

const created = engine.createBooking(showId, seatIds, userId);
printResult('createBooking', created);
if (!created.ok) process.exit(1);

const paid = engine.pay(created.bookingId, 'CARD');
printResult('pay', paid);
if (!paid.ok) process.exit(1);

printResult('getSeatMap', engine.getSeatMap(showId));

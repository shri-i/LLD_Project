const supabase = require('../config/supabase');
const engine = require('../engine/engine');
const { HttpError } = require('../middleware/errorHandler');

const hydratedShows = new Set();
const hydrationInProgress = new Map();

// Theatre timezone used for weekend/peak-hour pricing (default IST, UTC+05:30).
const utcOffsetMinutes = Number.parseInt(process.env.THEATRE_UTC_OFFSET_MINUTES || '330', 10);

function ensureQuerySucceeded(error, operation) {
  if (error) {
    console.error(`${operation} failed:`, error);
    throw new HttpError(500, 'Database query failed');
  }
}

async function hydrateShow(showId) {
  const showResult = await supabase
    .from('shows')
    .select('id,movie_id,screen_id,start_time,base_price')
    .eq('id', showId)
    .maybeSingle();
  ensureQuerySucceeded(showResult.error, 'loadShow');
  if (!showResult.data) throw new HttpError(404, 'Show not found');

  const show = showResult.data;
  const seatResult = await supabase
    .from('seats')
    .select('id,row_label,seat_number,seat_type')
    .eq('screen_id', show.screen_id)
    .order('row_label')
    .order('seat_number');
  ensureQuerySucceeded(seatResult.error, 'loadShowSeats');

  const bookingsResult = await supabase
    .from('bookings')
    .select('id')
    .eq('show_id', showId)
    .eq('status', 'CONFIRMED');
  ensureQuerySucceeded(bookingsResult.error, 'loadConfirmedBookings');

  let bookedSeatIds = [];
  if (bookingsResult.data.length > 0) {
    const bookingSeatResult = await supabase
      .from('booking_seats')
      .select('seat_id')
      .eq('show_id', showId)
      .in('booking_id', bookingsResult.data.map((booking) => booking.id));
    ensureQuerySucceeded(bookingSeatResult.error, 'loadConfirmedBookingSeats');
    bookedSeatIds = bookingSeatResult.data.map((bookingSeat) => bookingSeat.seat_id);
  }

  const bookedSeatSet = new Set(bookedSeatIds);
  const result = engine.loadShow({
    showId: show.id,
    movieId: show.movie_id,
    screenId: show.screen_id,
    startTime: show.start_time,
    basePrice: Number(show.base_price),
    utcOffsetMinutes: Number.isInteger(utcOffsetMinutes) ? utcOffsetMinutes : 330,
    seats: seatResult.data.map((seat) => ({
      seatId: seat.id,
      row: seat.row_label,
      number: seat.seat_number,
      type: seat.seat_type,
      status: bookedSeatSet.has(seat.id) ? 'BOOKED' : 'AVAILABLE',
    })),
  });

  if (!result.ok) {
    throw new HttpError(500, `Booking engine could not load show: ${result.reason || 'unknown error'}`);
  }
  hydratedShows.add(showId);
}

async function ensureShowHydrated(showId) {
  if (hydratedShows.has(showId)) return;
  if (!hydrationInProgress.has(showId)) {
    const hydration = hydrateShow(showId)
      .finally(() => hydrationInProgress.delete(showId));
    hydrationInProgress.set(showId, hydration);
  }
  await hydrationInProgress.get(showId);
}

async function getSeatMap(showId) {
  await ensureShowHydrated(showId);
  return engine.getSeatMap(showId);
}

module.exports = { getSeatMap, ensureShowHydrated };

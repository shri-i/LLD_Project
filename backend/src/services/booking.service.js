const { randomUUID } = require('node:crypto');
const supabase = require('../config/supabase');
const engine = require('../engine/engine');
const showService = require('./show.service');
const { HttpError } = require('../middleware/errorHandler');

// Engine booking IDs are process-local strings; API/database booking IDs are UUIDs.
const bookingsByApiId = new Map();

function ensureQuerySucceeded(error, operation) {
  if (!error) return;
  if (error.code === '23505') throw new HttpError(409, 'One or more seats have already been booked');
  console.error(`${operation} failed:`, error);
  throw new HttpError(500, 'Database operation failed');
}

function engineConflict(result, fallback) {
  throw new HttpError(409, result.reason || fallback);
}

async function lockSeats(showId, seatIds, userId) {
  await showService.ensureShowHydrated(showId);
  const result = engine.lockSeats(showId, seatIds, userId);
  if (!result.ok) engineConflict(result, 'One or more seats are unavailable');
  return result;
}

async function unlockSeats(showId, seatIds, userId) {
  await showService.ensureShowHydrated(showId);
  const result = engine.unlockSeats(showId, seatIds, userId);
  if (!result.ok) engineConflict(result, 'Seats are not locked by this user');
  return { ok: true };
}

async function createBooking(showId, seatIds, userId) {
  await showService.ensureShowHydrated(showId);
  const result = engine.createBooking(showId, seatIds, userId);
  if (!result.ok) engineConflict(result, 'Could not create booking');

  const bookingId = randomUUID();
  bookingsByApiId.set(bookingId, {
    engineBookingId: result.bookingId,
    showId,
    seatIds: [...seatIds],
    userId,
    totalAmount: Number(result.totalAmount),
    status: 'PENDING',
  });
  return { bookingId, status: 'PENDING', totalAmount: Number(result.totalAmount) };
}

async function pay(bookingId, mode, userId) {
  const pending = bookingsByApiId.get(bookingId);
  if (!pending || pending.userId !== userId) throw new HttpError(404, 'Booking not found');
  if (pending.status !== 'PENDING') throw new HttpError(409, 'Booking is not pending');

  // Payment is processed by the engine first. Persist only after it confirms.
  const payment = engine.pay(pending.engineBookingId, mode);
  if (!payment.ok || payment.status !== 'SUCCESS') {
    if (/expired/i.test(payment.reason || '')) bookingsByApiId.delete(bookingId);
    throw new HttpError(409, payment.reason || 'Payment failed');
  }
  // Block cancellation while the confirmed booking is being written to the database.
  pending.status = 'PAYING';

  const paymentId = payment.paymentId;
  let bookingInserted = false;
  try {
    const seatMap = engine.getSeatMap(pending.showId);
    const basePrices = pending.seatIds.map((seatId) => {
      const seat = seatMap.find((candidate) => candidate.seatId === seatId);
      return Math.max(0, Number(seat?.price) || 0);
    });
    const baseTotal = basePrices.reduce((sum, price) => sum + price, 0);
    let allocated = 0;
    const seatRows = pending.seatIds.map((seatId, index) => {
      const proportionalPrice = baseTotal > 0
        ? pending.totalAmount * basePrices[index] / baseTotal
        : pending.totalAmount / pending.seatIds.length;
      const price = index === pending.seatIds.length - 1
        ? Math.round((pending.totalAmount - allocated) * 100) / 100
        : Math.round(proportionalPrice * 100) / 100;
      allocated += price;
      return {
        booking_id: bookingId,
        seat_id: seatId,
        show_id: pending.showId,
        price,
      };
    });

    const bookingResult = await supabase.from('bookings').insert({
      id: bookingId,
      user_id: userId,
      show_id: pending.showId,
      status: 'CONFIRMED',
      total_amount: pending.totalAmount,
    });
    ensureQuerySucceeded(bookingResult.error, 'insertBooking');
    bookingInserted = true;

    // Allocate the strategy-adjusted engine total proportionally to the
    // hydrated seat prices so persisted seat prices sum to the paid amount.
    const seatsResult = await supabase.from('booking_seats').insert(seatRows);
    ensureQuerySucceeded(seatsResult.error, 'insertBookingSeats');

    const paymentResult = await supabase.from('payments').insert({
      booking_id: bookingId,
      mode,
      amount: pending.totalAmount,
      status: 'SUCCESS',
    });
    ensureQuerySucceeded(paymentResult.error, 'insertPayment');
  } catch (error) {
    // Best-effort compensation: undo the engine confirmation and remove any
    // committed database rows (booking_seats cascade from bookings).
    try {
      // Free the seats directly: a rollback must not be subject to the refund policy.
      const released = engine.releaseBookedSeats(pending.showId, pending.seatIds);
      if (!released.ok) console.error('Engine booking compensation failed:', released.reason);
    } catch (cancelError) {
      console.error('Engine booking compensation failed:', cancelError);
    }
    if (bookingInserted) {
      const cleanup = await supabase.from('bookings').delete().eq('id', bookingId);
      if (cleanup.error) console.error('Booking compensation cleanup failed:', cleanup.error);
    }
    bookingsByApiId.delete(bookingId);
    throw error;
  }

  pending.status = 'CONFIRMED';
  pending.paymentId = paymentId;
  return { bookingId, status: 'CONFIRMED', paymentId };
}

async function cancel(bookingId, userId) {
  const pending = bookingsByApiId.get(bookingId);
  if (pending && pending.userId !== userId) throw new HttpError(404, 'Booking not found');
  if (pending?.status === 'PAYING') throw new HttpError(409, 'Payment is in progress; try again shortly');
  if (pending?.status === 'CANCELLED') throw new HttpError(409, 'Booking is already cancelled');

  // Unpaid booking: it only exists in the engine, so release its seat locks.
  if (pending?.status === 'PENDING') {
    const result = engine.cancel(pending.engineBookingId);
    if (!result.ok) engineConflict(result, 'Could not cancel booking');
    pending.status = 'CANCELLED';
    return { bookingId, status: 'CANCELLED', refundAmount: 0 };
  }

  // Confirmed booking: the database is the source of truth. It may be from
  // before a server restart, in which case the engine no longer tracks it.
  const bookingResult = await supabase.from('bookings')
    .select('id,user_id,show_id,status,total_amount')
    .eq('id', bookingId)
    .maybeSingle();
  ensureQuerySucceeded(bookingResult.error, 'findBooking');
  const booking = bookingResult.data;
  if (!booking || booking.user_id !== userId) throw new HttpError(404, 'Booking not found');
  if (booking.status !== 'CONFIRMED') throw new HttpError(409, 'Booking cannot be cancelled');

  // The C++ RefundPolicy decides whether cancelling is allowed and how much is returned.
  await showService.ensureShowHydrated(booking.show_id);
  const quote = engine.quoteRefund(booking.show_id, Number(booking.total_amount));
  if (!quote.ok) engineConflict(quote, 'Booking cannot be cancelled');
  const refundAmount = Number(quote.refundAmount);

  const seatsResult = await supabase.from('booking_seats')
    .select('seat_id')
    .eq('booking_id', bookingId);
  ensureQuerySucceeded(seatsResult.error, 'findBookingSeats');
  const seatIds = seatsResult.data.map((row) => row.seat_id);

  const updateResult = await supabase.from('bookings')
    .update({ status: 'CANCELLED' })
    .eq('id', bookingId)
    .eq('user_id', userId);
  ensureQuerySucceeded(updateResult.error, 'cancelBooking');
  if (refundAmount > 0) {
    // Payments are a ledger: the refund is its own row next to the original charge.
    const original = await supabase.from('payments')
      .select('mode')
      .eq('booking_id', bookingId)
      .eq('status', 'SUCCESS');
    ensureQuerySucceeded(original.error, 'findPayment');
    const refundResult = await supabase.from('payments').insert({
      booking_id: bookingId,
      mode: original.data[0]?.mode || 'CARD',
      amount: refundAmount,
      status: 'REFUNDED',
    });
    ensureQuerySucceeded(refundResult.error, 'refundPayment');
  }

  // Release the seats in the database. UNIQUE (show_id, seat_id) covers every
  // booking_seats row, so a cancelled booking must give its rows up or nobody
  // could ever book those seats again. The booking and its payments remain.
  const releaseResult = await supabase.from('booking_seats')
    .delete()
    .eq('booking_id', bookingId);
  ensureQuerySucceeded(releaseResult.error, 'releaseBookingSeats');

  // Free the seats in the engine so they can be booked again right away.
  if (pending) {
    const result = engine.cancel(pending.engineBookingId);
    if (!result.ok) engine.releaseBookedSeats(pending.showId, pending.seatIds);
    pending.status = 'CANCELLED';
  } else if (seatIds.length > 0) {
    const result = engine.releaseBookedSeats(booking.show_id, seatIds);
    if (!result.ok) console.error('Engine seat release failed:', result.reason);
  }
  return { bookingId, status: 'CANCELLED', refundAmount };
}

async function getUserBookings(userId) {
  const { data, error } = await supabase.from('bookings')
    .select('id,show_id,status,total_amount,created_at,booking_seats(seat_id,price),payments(mode,amount,status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  ensureQuerySucceeded(error, 'getUserBookings');
  return data;
}

module.exports = { lockSeats, unlockSeats, createBooking, pay, cancel, getUserBookings };

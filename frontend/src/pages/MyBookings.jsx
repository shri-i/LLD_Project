import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function seatsFor(booking) {
  return (booking.booking_seats || []).map((item) => item.seat_id).join(', ') || 'Seat details unavailable';
}

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canceling, setCanceling] = useState('');
  const [notice, setNotice] = useState('');

  const loadBookings = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getBookings(user.id, { signal });
      setBookings(Array.isArray(result) ? result : (result?.bookings || []));
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBookings(controller.signal);
    return () => controller.abort();
  }, [loadBookings]);

  async function cancel(booking) {
    if (!window.confirm(`Cancel booking ${booking.id}?\n\nRefund policy: full refund 24h+ before the show, 50% from 24h to 2h, no cancellation in the last 2 hours.`)) return;
    setCanceling(booking.id);
    setError('');
    setNotice('');
    try {
      const result = await api.cancelBooking(booking.id);
      setNotice(`Booking cancelled. Refund: ${money.format(Number(result?.refundAmount) || 0)}.`);
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCanceling('');
    }
  }

  return <section className="bookings-page">
    <div className="section-heading"><div><p className="eyebrow">Your account</p><h1>My bookings</h1></div><Link className="text-link" to="/">Browse movies</Link></div>
    {notice && <p className="payment-message" role="status">{notice}</p>}
    {error && <div className="payment-message payment-message-error" role="alert">{error}<button className="button button-secondary" type="button" onClick={() => void loadBookings()}>Try again</button></div>}
    {loading && <div className="request-state" role="status"><span className="loading-dot" />Loading your bookings…</div>}
    {!loading && !error && bookings.length === 0 && <div className="empty-state"><h2>No bookings yet</h2><p>When you book a show, it will appear here.</p><Link className="text-link" to="/">Explore movies</Link></div>}
    {!loading && bookings.length > 0 && <div className="booking-list">
      {bookings.map((booking) => {
        const payments = Array.isArray(booking.payments) ? booking.payments : [booking.payments].filter(Boolean);
        const payment = payments.find((item) => item.status === 'SUCCESS') || payments[0];
        const refund = payments.find((item) => item.status === 'REFUNDED');
        const seats = seatsFor(booking);
        return <article className="booking-card" key={booking.id}>
          <div className="booking-card-heading"><div><p className="eyebrow">Booking</p><h2>{booking.id}</h2></div><span className={`booking-status status-${String(booking.status).toLowerCase()}`}>{booking.status}</span></div>
          <dl className="booking-info">
            <div><dt>Seats</dt><dd>{seats}</dd></div><div><dt>Total</dt><dd>{money.format(Number(booking.total_amount) || 0)}</dd></div>
            <div><dt>Booked</dt><dd>{booking.created_at ? dateTime.format(new Date(booking.created_at)) : '—'}</dd></div>
            <div><dt>Payment</dt><dd>{payment ? `${String(payment.mode).replace('_', ' ')} · ${payment.status}` : '—'}</dd></div>
            {refund && <div><dt>Refunded</dt><dd>{money.format(Number(refund.amount) || 0)}</dd></div>}
          </dl>
          {booking.status === 'CONFIRMED' && <button className="button button-cancel" type="button" disabled={canceling === booking.id} onClick={() => void cancel(booking)}>{canceling === booking.id ? 'Canceling…' : 'Cancel booking'}</button>}
        </article>;
      })}
    </div>}
  </section>;
}

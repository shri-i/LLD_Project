import { Link, useLocation } from 'react-router';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export default function BookingSuccess() {
  const { state } = useLocation();
  const seats = (state?.lock?.seats || []).map((seat) => `${seat.row}${seat.number}`).join(', ');
  return <section className="success-card">
    <div className="success-mark" aria-hidden="true">✓</div>
    <p className="eyebrow">You’re all set</p>
    <h1>Booking confirmed</h1>
    <p>Your payment was successful. We hope you enjoy the show.</p>
    <dl className="success-details">
      <div><dt>Booking reference</dt><dd>{state?.bookingId || 'Confirmed'}</dd></div>
      <div><dt>Movie</dt><dd>{state?.lock?.movie?.title || 'Your show'}</dd></div>
      <div><dt>Seats</dt><dd>{seats || 'See booking details'}</dd></div>
      <div><dt>Paid</dt><dd>{Number.isFinite(Number(state?.totalAmount)) ? money.format(Number(state.totalAmount)) : 'Payment complete'}{state?.mode ? ` · ${state.mode.replace('_', ' ')}` : ''}</dd></div>
    </dl>
    <div className="success-actions"><Link className="button button-primary" to="/my-bookings">View my bookings</Link><Link className="text-link" to="/">Browse movies</Link></div>
  </section>;
}

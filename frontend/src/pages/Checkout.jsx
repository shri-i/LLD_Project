import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { api } from '../api/client.js';
import LockTimer from '../components/LockTimer.jsx';
import PaymentForm from '../components/PaymentForm.jsx';
import { clearActiveLock, readActiveLock, releaseSeatLock } from '../utils/seatLock.js';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const EXPIRED_MESSAGE = 'Your seat hold has expired. Please choose your seats again to continue.';

function isExpiredError(error) {
  return /lock.{0,30}(expired|no longer)|expired.{0,30}lock|seat.{0,30}not locked/i.test(error.message || '');
}

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [lock] = useState(() => location.state?.lock || readActiveLock());
  const [mode, setMode] = useState('CARD');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [booking, setBooking] = useState(null);
  const leavingForSeats = useRef(false);
  const paymentComplete = useRef(false);
  const pendingRelease = useRef(undefined);

  const returnToSeats = useCallback(async (message = EXPIRED_MESSAGE) => {
    if (!lock || leavingForSeats.current) return;
    leavingForSeats.current = true;
    setExpired(true);
    await releaseSeatLock(lock);
    navigate(`/shows/${lock.showId}/seats`, {
      replace: true,
      state: { show: lock.show, movie: lock.movie, expiredMessage: message },
    });
  }, [lock, navigate]);

  useEffect(() => {
    if (!lock) return undefined;
    // React StrictMode (dev) mounts, unmounts and re-mounts effects immediately.
    // Defer the unmount release so that simulated unmount does not drop the hold.
    clearTimeout(pendingRelease.current);
    const releaseOnLeave = () => {
      if (!leavingForSeats.current && !paymentComplete.current) void releaseSeatLock(lock, { keepalive: true });
    };
    window.addEventListener('pagehide', releaseOnLeave);
    return () => {
      window.removeEventListener('pagehide', releaseOnLeave);
      pendingRelease.current = setTimeout(releaseOnLeave, 0);
    };
  }, [lock]);

  const handleExpire = useCallback(() => { void returnToSeats(); }, [returnToSeats]);

  async function pay() {
    if (processing || expired || !lock) return;
    if (Date.now() >= Number(lock.expiresAt)) {
      await returnToSeats();
      return;
    }
    setProcessing(true);
    setError('');
    try {
      let currentBooking = booking;
      if (!currentBooking) {
        currentBooking = await api.createBooking(lock.showId, lock.seatIds);
        setBooking(currentBooking);
      }
      const result = await api.payBooking(currentBooking.bookingId, mode);
      paymentComplete.current = true;
      clearActiveLock();
      navigate('/booking-success', {
        replace: true,
        state: { bookingId: result.bookingId, totalAmount: currentBooking.totalAmount, mode, lock },
      });
    } catch (requestError) {
      if (isExpiredError(requestError)) {
        setError(EXPIRED_MESSAGE);
        await returnToSeats();
      } else {
        setError(requestError.status === 409
          ? `${requestError.message}. You can choose another payment method and retry while your seats are held.`
          : `${requestError.message} You can retry while your seat hold is active.`);
      }
    } finally {
      setProcessing(false);
    }
  }

  if (!lock) {
    return <section className="empty-state"><p className="eyebrow">No active seat hold</p><h1>Your checkout is empty.</h1><p>Choose a showtime and seats to start again.</p><Link className="text-link" to="/">Browse movies</Link></section>;
  }

  const theatre = lock.show?.screen?.theatre;
  const startTime = lock.show?.start_time ? new Date(lock.show.start_time) : null;
  const seatNames = [...(lock.seats || [])].sort((a, b) => String(a.row).localeCompare(String(b.row)) || Number(a.number) - Number(b.number)).map((seat) => `${seat.row}${seat.number}`);
  const total = Number(booking?.totalAmount ?? (lock.seats || []).reduce((sum, seat) => sum + (Number(seat.price) || 0), 0));

  return <>
    <Link className="back-link" to={`/shows/${lock.showId}/seats`} state={{ show: lock.show, movie: lock.movie }}>← <span>Back to seats</span></Link>
    <section className="checkout-heading"><div><p className="eyebrow">Almost there</p><h1>Review and pay</h1><p>Your seats are held while you complete checkout.</p></div><LockTimer expiresAt={lock.expiresAt} onExpire={handleExpire} /></section>
    <section className="checkout-card">
      <div className="checkout-film"><div className="checkout-film-mark" aria-hidden="true">{lock.movie?.title?.slice(0, 1) || 'S'}</div><div><p className="eyebrow">Movie</p><h2>{lock.movie?.title || 'Your show'}</h2><p>{[lock.movie?.language, lock.movie?.genre].filter(Boolean).join(' · ')}</p></div></div>
      <dl className="checkout-details">
        <div><dt>Theatre</dt><dd>{theatre?.name || 'Theatre'}</dd></div><div><dt>Screen</dt><dd>{lock.show?.screen?.name || 'Screen'}</dd></div>
        <div><dt>Showtime</dt><dd>{startTime && !Number.isNaN(startTime.getTime()) ? dateTime.format(startTime) : 'Time not available'}</dd></div>
        <div><dt>Seats</dt><dd>{seatNames.join(', ') || `${lock.seatIds.length} selected`}</dd></div>
      </dl>
      <div className="checkout-total"><span>Total for {lock.seatIds.length} {lock.seatIds.length === 1 ? 'seat' : 'seats'}</span><strong>{money.format(total)}</strong></div>
      {expired && <p className="payment-message payment-message-error" role="alert">{EXPIRED_MESSAGE}</p>}
      {error && !expired && <p className="payment-message payment-message-error" role="alert">{error}</p>}
      {!expired && <PaymentForm mode={mode} onModeChange={setMode} onPay={pay} processing={processing} disabled={Date.now() >= Number(lock.expiresAt)} />}
    </section>
  </>;
}

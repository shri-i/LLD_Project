import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api, getToken } from '../api/client.js';
import LockTimer from '../components/LockTimer.jsx';
import SeatMap from '../components/SeatMap.jsx';
import { ErrorState, LoadingState } from '../components/RequestState.jsx';
import useSeats from '../hooks/useSeats.js';
import { clearActiveLock, readActiveLock, releaseSeatLock, saveActiveLock } from '../utils/seatLock.js';

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function SeatSelection() {
  const { id: showId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const show = location.state?.show;
  const movie = location.state?.movie;
  const { seats, loading, refreshing, error, refresh, retry } = useSeats(showId);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [lockError, setLockError] = useState(() => location.state?.expiredMessage || '');
  const [locking, setLocking] = useState(false);
  const preserveLockOnUnmount = useRef(false);

  useEffect(() => {
    const releaseIfLeaving = () => {
      const lock = readActiveLock();
      if (!preserveLockOnUnmount.current && lock?.showId === showId) {
        void releaseSeatLock(lock, { keepalive: true });
      }
    };
    window.addEventListener('pagehide', releaseIfLeaving);
    return () => {
      window.removeEventListener('pagehide', releaseIfLeaving);
      releaseIfLeaving();
    };
  }, [showId]);

  useEffect(() => {
    if (selectedSeatIds.length === 0 || seats.length === 0) return;
    const availableIds = new Set(seats.filter((seat) => seat.status === 'AVAILABLE').map((seat) => seat.seatId));
    const retained = selectedSeatIds.filter((seatId) => availableIds.has(seatId));
    if (retained.length !== selectedSeatIds.length) {
      setSelectedSeatIds(retained);
      setLockError('A selected seat is no longer available. Please review your selection.');
    }
  }, [seats, selectedSeatIds]);

  const selectedSeats = useMemo(
    () => selectedSeatIds.map((seatId) => seats.find((seat) => seat.seatId === seatId)).filter(Boolean),
    [selectedSeatIds, seats],
  );
  const estimate = selectedSeats.reduce((sum, seat) => sum + (Number(seat.price) || 0), 0);

  function toggleSeat(seat) {
    setLockError('');
    setSelectedSeatIds((current) => current.includes(seat.seatId)
      ? current.filter((seatId) => seatId !== seat.seatId)
      : [...current, seat.seatId]);
  }

  function goToLogin() {
    navigate('/login', {
      state: { returnTo: location.pathname, show, movie },
    });
  }

  async function proceed() {
    if (selectedSeatIds.length === 0 || locking) return;
    if (!getToken()) {
      goToLogin();
      return;
    }

    setLocking(true);
    setLockError('');
    try {
      const result = await api.lockSeats(showId, selectedSeatIds);
      if (!result?.ok || !Number.isFinite(Number(result.expiresAt))) {
        throw new Error(result?.reason || 'The seats could not be locked. Please try again.');
      }
      const lock = {
        showId,
        seatIds: [...selectedSeatIds],
        seats: selectedSeats,
        expiresAt: Number(result.expiresAt),
        show,
        movie,
      };
      saveActiveLock(lock);
      preserveLockOnUnmount.current = true;
      navigate('/checkout', { state: { lock }, replace: false });
    } catch (requestError) {
      if (requestError.status === 401) {
        goToLogin();
      } else if (requestError.status === 409) {
        setLockError('Those seats were just taken. We refreshed the seat map; please choose again.');
        const updatedSeats = await refresh();
        if (Array.isArray(updatedSeats)) {
          const available = new Set(updatedSeats.filter((seat) => seat.status === 'AVAILABLE').map((seat) => seat.seatId));
          setSelectedSeatIds((current) => current.filter((seatId) => available.has(seatId)));
        }
      } else {
        setLockError(requestError.message);
      }
    } finally {
      setLocking(false);
    }
  }

  return (
    <>
      <Link className="back-link" to={movie ? `/movies/${movie.id}` : '/'} state={{ movie }}>← <span>Back to showtimes</span></Link>
      <section className="seat-page-heading">
        <div>
          <p className="eyebrow">Pick your seats</p>
          <h1>{movie?.title || 'Select seats'}</h1>
          <p>{show?.screen?.theatre?.name || 'Choose your seats'}{show?.screen?.name ? ` · ${show.screen.name}` : ''}</p>
        </div>
        {refreshing && <span className="refresh-indicator" role="status">Updating seats…</span>}
      </section>

      {error && <ErrorState message={error} onRetry={retry} />}
      {loading && <LoadingState label="Loading the seat map…" />}
      {!loading && !error && seats.length === 0 && (
        <div className="empty-state"><h2>No seat map is available.</h2><p>Try again in a little while.</p><button className="button button-secondary" type="button" onClick={retry}>Refresh seat map</button></div>
      )}
      {!loading && !error && seats.length > 0 && (
        <>
          <SeatMap
            seats={seats}
            selectedSeatIds={selectedSeatIds}
            onToggleSeat={toggleSeat}
            screenName={show?.screen?.name}
          />
          {!getToken() && <p className="signin-hint">Sign in is required to hold seats. You can choose seats before signing in.</p>}
          {lockError && <p className="seat-lock-error" role="alert">{lockError}</p>}
          <div className="seat-selection-footer">
            <div className="selection-summary">
              <strong>{selectedSeatIds.length} {selectedSeatIds.length === 1 ? 'seat' : 'seats'} selected</strong>
              {selectedSeats.length > 0 && <span>{selectedSeats.map((seat) => `${seat.row}${seat.number}`).join(', ')} · approx. {currency.format(estimate)}</span>}
            </div>
            <button className="button button-primary proceed-button" type="button" disabled={selectedSeatIds.length === 0 || locking} onClick={proceed}>
              {locking ? 'Holding seats…' : (getToken() ? 'Proceed' : 'Sign in to proceed')} <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

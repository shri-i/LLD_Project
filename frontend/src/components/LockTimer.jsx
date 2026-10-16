import { useEffect, useState } from 'react';

function getRemaining(expiresAt) {
  return Math.max(0, Math.ceil((Number(expiresAt) - Date.now()) / 1000));
}

export default function LockTimer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(() => getRemaining(expiresAt));

  useEffect(() => {
    let expired = false;
    const update = () => {
      const next = getRemaining(expiresAt);
      setRemaining(next);
      if (next === 0 && !expired) {
        expired = true;
        onExpire();
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [expiresAt, onExpire]);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <div className={`lock-timer${remaining <= 60 ? ' lock-timer-urgent' : ''}`} role="timer" aria-live="off">
      <span className="timer-icon" aria-hidden="true">◷</span>
      <span>Seats held for</span>
      <strong>{minutes}:{seconds}</strong>
    </div>
  );
}

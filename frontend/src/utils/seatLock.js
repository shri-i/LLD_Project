import { api } from '../api/client.js';

const LOCK_KEY = 'bookmyshow.active-seat-lock';
let releaseInFlight;

export function readActiveLock() {
  try {
    const value = window.sessionStorage.getItem(LOCK_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function saveActiveLock(lock) {
  window.sessionStorage.setItem(LOCK_KEY, JSON.stringify(lock));
}

export function clearActiveLock() {
  window.sessionStorage.removeItem(LOCK_KEY);
}

export function releaseSeatLock(lock, { keepalive = true } = {}) {
  if (!lock?.showId || !Array.isArray(lock.seatIds) || lock.seatIds.length === 0) {
    clearActiveLock();
    return Promise.resolve();
  }
  if (releaseInFlight) return releaseInFlight;

  releaseInFlight = api.unlockSeats(lock.showId, lock.seatIds, { keepalive })
    .catch((error) => {
      // A 409 here usually means the engine TTL already released the seats.
      if (error.status !== 409) console.warn('Could not release the seat lock:', error.message);
    })
    .finally(() => {
      const current = readActiveLock();
      if (current?.showId === lock.showId) clearActiveLock();
      releaseInFlight = undefined;
    });
  return releaseInFlight;
}

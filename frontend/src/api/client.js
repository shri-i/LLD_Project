const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'bookmyshow.jwt';
export const SESSION_EXPIRED_EVENT = 'bookmyshow:session-expired';

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const { headers: suppliedHeaders, ...requestOptions } = options;
  const headers = new Headers(suppliedHeaders);
  const token = getToken();

  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (requestOptions.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    // A rejected token means the session expired: sign the user out everywhere.
    if (response.status === 401 && headers.has('Authorization')) {
      setToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  getCities: (options = {}) => apiRequest('/cities', options),
  getMovies: (cityId, options = {}) => apiRequest(`/movies?city=${encodeURIComponent(cityId)}`, options),
  getShows: (movieId, options = {}) => apiRequest(`/movies/${encodeURIComponent(movieId)}/shows`, options),
  getSeatMap: (showId, options = {}) => apiRequest(`/shows/${encodeURIComponent(showId)}/seats`, options),
  lockSeats: (showId, seatIds, options = {}) => apiRequest(`/shows/${encodeURIComponent(showId)}/lock`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({ seatIds }),
  }),
  unlockSeats: (showId, seatIds, options = {}) => apiRequest(`/shows/${encodeURIComponent(showId)}/unlock`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({ seatIds }),
  }),
  login: (credentials, options = {}) => apiRequest('/auth/login', {
    ...options,
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  register: (details, options = {}) => apiRequest('/auth/register', {
    ...options,
    method: 'POST',
    body: JSON.stringify(details),
  }),
  createBooking: (showId, seatIds, options = {}) => apiRequest('/bookings', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ showId, seatIds }),
  }),
  payBooking: (bookingId, mode, options = {}) => apiRequest(`/bookings/${encodeURIComponent(bookingId)}/pay`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({ mode }),
  }),
  cancelBooking: (bookingId, options = {}) => apiRequest(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    ...options,
    method: 'POST',
  }),
  getBookings: (userId, options = {}) => apiRequest(`/users/${encodeURIComponent(userId)}/bookings`, options),
};

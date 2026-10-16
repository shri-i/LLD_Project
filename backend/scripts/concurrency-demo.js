const API_URL = (process.env.API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

async function request(path, { token, ...options } = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function login(prefix) {
  const email = process.env[`DEMO_${prefix}_EMAIL`];
  const password = process.env[`DEMO_${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Set DEMO_${prefix}_EMAIL and DEMO_${prefix}_PASSWORD to existing account credentials`);
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

async function main() {
  const [firstUser, secondUser] = await Promise.all([login('USER_ONE'), login('USER_TWO')]);
  const cities = await request('/cities');
  const cityName = process.env.DEMO_CITY || cities[0]?.name;
  if (!cityName) throw new Error('No cities are available in the database');
  const movies = await request(`/movies?city=${encodeURIComponent(cityName)}`);

  let candidate;
  for (const movie of movies) {
    const shows = await request(`/movies/${encodeURIComponent(movie.id)}/shows`);
    for (const show of shows) {
      const seats = await request(`/shows/${encodeURIComponent(show.id)}/seats`);
      const seat = seats.find((item) => item.status === 'AVAILABLE');
      if (seat) {
        candidate = { movie, show, seat };
        break;
      }
    }
    if (candidate) break;
  }
  if (!candidate) throw new Error(`No available seats found for ${cityName}; run db/seed.sql for sample data`);

  const attempts = await Promise.all([
    request(`/shows/${candidate.show.id}/lock`, { method: 'POST', token: firstUser.token, body: JSON.stringify({ seatIds: [candidate.seat.seatId] }) })
      .then((result) => ({ user: 'one', ok: true, result }))
      .catch((error) => ({ user: 'one', ok: false, status: error.status, error: error.message })),
    request(`/shows/${candidate.show.id}/lock`, { method: 'POST', token: secondUser.token, body: JSON.stringify({ seatIds: [candidate.seat.seatId] }) })
      .then((result) => ({ user: 'two', ok: true, result }))
      .catch((error) => ({ user: 'two', ok: false, status: error.status, error: error.message })),
  ]);

  const winners = attempts.filter((attempt) => attempt.ok);
  console.log(`Show: ${candidate.movie.title} — ${candidate.show.id}`);
  console.log(`Seat: ${candidate.seat.row}${candidate.seat.number} (${candidate.seat.seatId})`);
  console.log(JSON.stringify(attempts, null, 2));
  console.log(`Successful locks: ${winners.length} (expected exactly 1)`);

  if (winners.length === 1) {
    const winnerToken = winners[0].user === 'one' ? firstUser.token : secondUser.token;
    await request(`/shows/${candidate.show.id}/unlock`, {
      method: 'POST',
      token: winnerToken,
      body: JSON.stringify({ seatIds: [candidate.seat.seatId] }),
    }).catch((error) => console.warn(`Could not release demo lock: ${error.message}`));
  }
  if (winners.length !== 1) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Concurrency demo failed: ${error.message}`);
  process.exitCode = 1;
});

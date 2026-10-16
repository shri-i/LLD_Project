process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough-for-tests';

const { randomUUID } = require('node:crypto');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/config/supabase');

const originalFrom = supabase.from;
const database = {
  users: [],
  shows: [],
  seats: [],
  bookings: [],
  booking_seats: [],
  payments: [],
  failInsertTable: null,
};

function matches(row, filters) {
  return filters.every((filter) => {
    if (filter.kind === 'eq') return row[filter.column] === filter.value;
    if (filter.kind === 'in') return filter.value.includes(row[filter.column]);
    return true;
  });
}

function makeQuery(table) {
  let operation = 'select';
  let payload;
  let filters = [];
  let sort;
  let cardinality;

  const query = {
    select() { return query; },
    insert(value) { operation = 'insert'; payload = value; return query; },
    update(value) { operation = 'update'; payload = value; return query; },
    delete() { operation = 'delete'; return query; },
    eq(column, value) { filters.push({ kind: 'eq', column, value }); return query; },
    in(column, value) { filters.push({ kind: 'in', column, value }); return query; },
    order(column, options = {}) { sort = { column, ascending: options.ascending !== false }; return query; },
    gte() { return query; },
    lt() { return query; },
    single() { cardinality = 'single'; return execute(); },
    maybeSingle() { cardinality = 'maybeSingle'; return execute(); },
    then(resolve, reject) { return execute().then(resolve, reject); },
  };

  async function execute() {
    const rows = database[table];
    if (operation === 'select') {
      let data = rows.filter((row) => matches(row, filters));
      if (sort) data = [...data].sort((a, b) => (a[sort.column] > b[sort.column] ? 1 : -1) * (sort.ascending ? 1 : -1));
      if (cardinality) {
        if (data.length === 0 && cardinality === 'maybeSingle') return { data: null, error: null };
        if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'Expected one row' } };
        return { data: data[0], error: null };
      }
      return { data, error: null };
    }
    if (operation === 'insert') {
      if (database.failInsertTable === table) {
        database.failInsertTable = null;
        return { data: null, error: { code: 'TEST_FAILURE', message: 'simulated insert failure' } };
      }
      const inserted = (Array.isArray(payload) ? payload : [payload]).map((input) => ({
        ...(table === 'users' && !input.id ? { id: randomUUID() } : {}),
        ...input,
      }));
      if (table === 'booking_seats' && inserted.some((candidate) => rows.some((row) => row.show_id === candidate.show_id && row.seat_id === candidate.seat_id))) {
        return { data: null, error: { code: '23505', message: 'duplicate seat' } };
      }
      rows.push(...inserted);
      return { data: cardinality ? inserted[0] : null, error: null };
    }
    const selected = rows.filter((row) => matches(row, filters));
    if (operation === 'update') selected.forEach((row) => Object.assign(row, payload));
    if (operation === 'delete') {
      for (const row of selected) {
        const index = rows.indexOf(row);
        if (index >= 0) rows.splice(index, 1);
      }
      if (table === 'bookings') {
        const ids = selected.map((row) => row.id);
        for (const childTable of ['booking_seats', 'payments']) {
          database[childTable] = database[childTable].filter((row) => !ids.includes(row.booking_id));
        }
      }
    }
    return { data: null, error: null };
  }

  return query;
}

supabase.from = (table) => makeQuery(table);

after(() => {
  supabase.from = originalFrom;
});

async function register(name) {
  const response = await request(app).post('/api/auth/register').send({
    name,
    email: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID()}@example.test`,
    phone: '555-0100',
    password: 'a-long-test-password',
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

function seedShow(seatCount) {
  const showId = randomUUID();
  const screenId = randomUUID();
  const seats = Array.from({ length: seatCount }, (_, index) => ({
    id: randomUUID(),
    screen_id: screenId,
    row_label: 'A',
    seat_number: index + 1,
    seat_type: 'REGULAR',
  }));
  database.shows.push({
    id: showId,
    movie_id: randomUUID(),
    screen_id: screenId,
    start_time: '2027-01-10T19:30:00.000Z',
    base_price: 200,
  });
  database.seats.push(...seats);
  return { showId, seatIds: seats.map((seat) => seat.id) };
}

test('register, lock, create, pay, list, and cancel a confirmed booking', async () => {
  const auth = await register('Happy Path');
  assert.ok(auth.token);
  assert.equal(Object.hasOwn(auth.user, 'password_hash'), false);
  const savedUser = database.users.find((user) => user.id === auth.user.id);
  assert.ok(savedUser.password_hash.startsWith('$2'));
  assert.notEqual(savedUser.password_hash, 'a-long-test-password');

  const { showId, seatIds } = seedShow(1);
  const authHeader = { Authorization: `Bearer ${auth.token}` };
  const lock = await request(app).post(`/api/shows/${showId}/lock`).set(authHeader).send({ seatIds });
  assert.equal(lock.status, 200, JSON.stringify(lock.body));
  assert.equal(lock.body.ok, true);

  const created = await request(app).post('/api/bookings').set(authHeader).send({ showId, seatIds });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.status, 'PENDING');

  const paid = await request(app).post(`/api/bookings/${created.body.bookingId}/pay`).set(authHeader).send({ mode: 'CARD' });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.status, 'CONFIRMED');
  assert.equal(database.bookings.length, 1);
  assert.equal(database.booking_seats.length, 1);
  assert.equal(database.payments.length, 1);
  assert.equal(database.bookings[0].status, 'CONFIRMED');
  assert.equal(database.booking_seats[0].price, database.bookings[0].total_amount);

  const history = await request(app).get(`/api/users/${auth.user.id}/bookings`).set(authHeader);
  assert.equal(history.status, 200, JSON.stringify(history.body));
  assert.equal(history.body.length, 1);

  const cancelled = await request(app)
    .post(`/api/bookings/${created.body.bookingId}/cancel`)
    .set(authHeader);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(database.bookings[0].status, 'CANCELLED');
  assert.equal(cancelled.body.refundAmount, database.bookings[0].total_amount);
  assert.equal(database.payments[0].status, 'SUCCESS');
  assert.equal(database.payments[1].status, 'REFUNDED');
  assert.equal(database.payments[1].amount, database.bookings[0].total_amount);
  const cancelledHistory = await request(app).get(`/api/users/${auth.user.id}/bookings`).set(authHeader);
  assert.equal(cancelledHistory.body[0].status, 'CANCELLED');
  const availableAgain = await request(app).get(`/api/shows/${showId}/seats`);
  assert.equal(availableAgain.body[0].status, 'AVAILABLE');

  const otherUser = await register('Another User');
  const forbidden = await request(app)
    .get(`/api/users/${auth.user.id}/bookings`)
    .set('Authorization', `Bearer ${otherUser.token}`);
  assert.equal(forbidden.status, 403);
});

test('two authenticated users racing for the same seat: one lock succeeds', async () => {
  const [first, second] = await Promise.all([register('Racer One'), register('Racer Two')]);
  const { showId, seatIds } = seedShow(1);
  const lockSeat = (auth) => request(app)
    .post(`/api/shows/${showId}/lock`)
    .set('Authorization', `Bearer ${auth.token}`)
    .send({ seatIds });
  const results = await Promise.all([lockSeat(first), lockSeat(second)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
});

test('a persistence failure after payment cancels the engine booking and removes partial rows', async () => {
  const auth = await register('Rollback User');
  const { showId, seatIds } = seedShow(1);
  const authHeader = { Authorization: `Bearer ${auth.token}` };
  const lock = await request(app).post(`/api/shows/${showId}/lock`).set(authHeader).send({ seatIds });
  assert.equal(lock.status, 200);
  const created = await request(app).post('/api/bookings').set(authHeader).send({ showId, seatIds });
  assert.equal(created.status, 201);

  const bookingCount = database.bookings.length;
  const seatCount = database.booking_seats.length;
  const paymentCount = database.payments.length;
  database.failInsertTable = 'payments';
  const paid = await request(app).post(`/api/bookings/${created.body.bookingId}/pay`).set(authHeader).send({ mode: 'UPI' });
  assert.equal(paid.status, 500);
  assert.equal(database.bookings.length, bookingCount);
  assert.equal(database.booking_seats.length, seatCount);
  assert.equal(database.payments.length, paymentCount);

  const seatMap = await request(app).get(`/api/shows/${showId}/seats`);
  assert.equal(seatMap.status, 200);
  assert.equal(seatMap.body[0].status, 'AVAILABLE');
});

test('the seat map price equals the amount charged for a booking', async () => {
  const auth = await register('Price Check');
  const { showId, seatIds } = seedShow(2);
  database.seats.find((seat) => seat.id === seatIds[1]).seat_type = 'VIP';
  const authHeader = { Authorization: `Bearer ${auth.token}` };

  const seatMap = await request(app).get(`/api/shows/${showId}/seats`);
  assert.equal(seatMap.status, 200);
  const shownTotal = seatMap.body.reduce((sum, seat) => sum + seat.price, 0);
  assert.ok(seatMap.body[1].price > seatMap.body[0].price, 'VIP must cost more than REGULAR');

  await request(app).post(`/api/shows/${showId}/lock`).set(authHeader).send({ seatIds });
  const created = await request(app).post('/api/bookings').set(authHeader).send({ showId, seatIds });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.totalAmount, shownTotal);
});

test('cancelling a confirmed booking the engine does not track (after a restart) frees the seat', async () => {
  const auth = await register('Restart User');
  const { showId, seatIds } = seedShow(1);
  const bookingId = randomUUID();
  database.bookings.push({ id: bookingId, user_id: auth.user.id, show_id: showId, status: 'CONFIRMED', total_amount: 200 });
  database.booking_seats.push({ booking_id: bookingId, seat_id: seatIds[0], show_id: showId, price: 200 });

  const before = await request(app).get(`/api/shows/${showId}/seats`);
  assert.equal(before.body[0].status, 'BOOKED');

  const cancelled = await request(app).post(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${auth.token}`);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

  const after = await request(app).get(`/api/shows/${showId}/seats`);
  assert.equal(after.body[0].status, 'AVAILABLE');
});

test('a seat from a cancelled booking can be booked again', async () => {
  const first = await register('First Buyer');
  const second = await register('Second Buyer');
  const { showId, seatIds } = seedShow(1);
  const bookSeat = async (auth) => {
    const header = { Authorization: `Bearer ${auth.token}` };
    const lock = await request(app).post(`/api/shows/${showId}/lock`).set(header).send({ seatIds });
    assert.equal(lock.status, 200, JSON.stringify(lock.body));
    const created = await request(app).post('/api/bookings').set(header).send({ showId, seatIds });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const paid = await request(app).post(`/api/bookings/${created.body.bookingId}/pay`).set(header).send({ mode: 'UPI' });
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    return created.body.bookingId;
  };

  const firstBooking = await bookSeat(first);
  const cancelled = await request(app).post(`/api/bookings/${firstBooking}/cancel`)
    .set('Authorization', `Bearer ${first.token}`);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
  assert.equal(database.booking_seats.some((row) => row.booking_id === firstBooking), false);

  // Previously failed with 409 "already booked": the cancelled row kept the UNIQUE slot.
  const secondBooking = await bookSeat(second);
  assert.ok(database.booking_seats.some((row) => row.booking_id === secondBooking));
});

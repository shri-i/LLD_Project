const express = require('express');
const citiesRoutes = require('./routes/cities.routes');
const moviesRoutes = require('./routes/movies.routes');
const showsRoutes = require('./routes/shows.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const usersRoutes = require('./routes/users.routes');
const authRoutes = require('./routes/auth.routes');
const { HttpError, errorHandler } = require('./middleware/errorHandler');

const app = express();

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : []),
]);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && allowedOrigins.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(express.json());
app.use('/api/cities', citiesRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/shows', showsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use((req, res, next) => next(new HttpError(404, 'Route not found')));
app.use(errorHandler);

module.exports = app;

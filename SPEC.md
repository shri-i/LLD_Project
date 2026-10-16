# BookMyShow: Project Spec

Full-stack movie ticket booking system. This file is the single source of truth. Every coding stage reads it first.

## 1. Architecture

React (Vite, JavaScript) -> Node.js (Express) -> C++ core (via N-API addon) ; Node -> Supabase (Postgres)

- React: browse movies and shows, seat map, lock countdown, checkout, booking history.
- Node/Express: REST API, validation, auth, Supabase access, calls the C++ engine.
- C++ core: the LLD. Seat state machine, locking with TTL, pricing strategies, payment factory + strategies, observers.
- Supabase: persistent data (users, movies, theatres, shows, confirmed bookings, payments).

## 2. State rules

- Seat locks and pending bookings live in C++ memory, protected by mutexes, with a TTL (default 300s).
- Node loads a show's seats and confirmed bookings from Supabase and hydrates the engine on first access.
- After the engine confirms a payment, Node writes booking, booking_seats and payment rows to Supabase.
- booking_seats has UNIQUE (show_id, seat_id) as a safety net against double booking.
- Limitation: single Node instance only. Multi-instance would need DB-level locking or Redis.

## 3. C++ design

Language: C++17. Build: CMake. Tests: GoogleTest. Binding: node-addon-api + cmake-js.

Enums: SeatType (REGULAR, PREMIUM, VIP), SeatStatus (AVAILABLE, LOCKED, BOOKED), BookingStatus (PENDING, CONFIRMED, CANCELLED, EXPIRED), PaymentMode (CARD, UPI, NET_BANKING), PaymentStatus (PENDING, SUCCESS, FAILED, REFUNDED).

Models: City, Theatre, Screen, Seat, Movie, Show, ShowSeat, User, Booking, Payment.
- ShowSeat: state machine (AVAILABLE, LOCKED, BOOKED) with private seat, basePrice, status, lockedByUserId, lockExpiry. Methods: tryLock, unlock, confirm, release, releaseIfExpired. Not thread-safe by itself.
- Show: aggregate root. Owns its ShowSeats (vector + seatId index) and one std::mutex; all seat changes go through it (lockSeats, unlockSeats, confirmSeats, releaseSeats, holdExpiry, seatMap).
- Booking: state machine PENDING -> CONFIRMED | CANCELLED | EXPIRED, CONFIRMED -> CANCELLED (canTransition / transitionTo). Carries its seat-hold expiry.

Patterns:
- Singleton: SeatLockManager (thread-safe function-local static).
- Strategy: PaymentStrategy (CardPayment, UpiPayment, NetBankingPayment); PricingStrategy rules (SeatTypePricing, WeekendPricing, PeakHourPricing) chained by PricingEngine; RefundPolicy (TieredRefundPolicy: 100% at 24h+, 50% at 2-24h, none under 2h; FullRefundPolicy).
- Dependency injection: BookingService receives SeatLockManager, NotificationService, PricingEngine and RefundPolicy through its constructor.
- Factory: PaymentFactory::create(PaymentMode) returns unique_ptr<PaymentStrategy>.
- Observer: BookingObserver (EmailNotifier, SmsNotifier) subscribed to NotificationService. In dev they just log.

Concurrency rules:
- SeatLockManager registry uses std::shared_mutex (shared for lookups, exclusive to add/remove shows).
- Each Show has one mutex; a request holds at most one show lock, so it cannot deadlock.
- Multi-seat operations are two-phase (check every seat, then change all): all-or-nothing with nothing to roll back.
- An expired hold reads as AVAILABLE immediately; a background thread clears it periodically.
- Use std::chrono (steady_clock for expiry), RAII locks, smart pointers.

## 4. Engine JSON contract (C++ <-> Node)

All values cross the boundary as JSON strings.

- loadShow(json): { showId, startTime, basePrice, utcOffsetMinutes?, seats: [{ seatId, row, number, type, status, price? }] }
  - seat price defaults to basePrice x seat type (REGULAR 1.0, PREMIUM 1.25, VIP 1.5); weekend/peak use the theatre's local time (utcOffsetMinutes, default 330 = IST)
- getSeatMap(showId) -> [{ seatId, row, number, type, status, price }]  (price = final price charged per seat)
- lockSeats(showId, seatIds[], userId) -> { ok, expiresAt, reason? }
- unlockSeats(showId, seatIds[], userId) -> { ok }
- createBooking(showId, seatIds[], userId) -> { ok, bookingId, totalAmount, reason? }
- pay(bookingId, mode) -> { ok, status, paymentId?, reason? }
- cancel(bookingId) -> { ok, refundAmount, reason? }
- quoteRefund(showId, amount) -> { ok, refundAmount, reason? }  (RefundPolicy decision if cancelled now)
- releaseBookedSeats(showId, seatIds[]) -> { ok }  (free BOOKED seats of a booking the engine no longer tracks)
- releaseExpired() -> { released: number, expiredBookings: number }

## 5. REST API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/cities | List cities |
| GET | /api/movies?city= | Movies in a city |
| GET | /api/movies/:id/shows?date= | Shows with theatre and time |
| GET | /api/shows/:id/seats | Seat map with status and price |
| POST | /api/shows/:id/lock | Lock selected seats |
| POST | /api/shows/:id/unlock | Release locks |
| POST | /api/bookings | Create pending booking from locked seats |
| POST | /api/bookings/:id/pay | Pay and confirm |
| POST | /api/bookings/:id/cancel | Cancel and refund |
| GET | /api/users/:id/bookings | Booking history |
| POST | /api/auth/register, /api/auth/login | Auth |

Errors: JSON { error: string }. Status codes: 400 validation, 401 auth, 404 missing, 409 seat conflict, 500 server.

## 6. Database schema (Supabase / Postgres)

- users (id, name, email, phone)
- cities (id, name)
- theatres (id, city_id, name, address)
- screens (id, theatre_id, name)
- seats (id, screen_id, row_label, seat_number, seat_type)
- movies (id, title, duration_mins, language, genre, poster_url)
- shows (id, movie_id, screen_id, start_time, end_time, base_price)
- bookings (id, user_id, show_id, status, total_amount, created_at)
- booking_seats (booking_id, seat_id, show_id, price) with UNIQUE (show_id, seat_id)
- payments (id, booking_id, mode, amount, status, created_at)

## 7. Folder structure

```
BookMyShow/
  README.md, docker-compose.yml (optional), .gitignore, SPEC.md
  core/        CMakeLists.txt, include/ (enums, models, services, payment, pricing, observer, utils),
               src/ (same layout + bindings/addon.cpp), tests/
  backend/     package.json, .env.example, src/ (server.js, app.js, config/supabase.js,
               engine/engine.js, routes/, controllers/, services/, middleware/, utils/)
  frontend/    package.json, vite.config.js, .env.example, src/ (main.jsx, App.jsx, api/client.js,
               pages/, components/, context/AuthContext.jsx, hooks/useSeats.js, styles/)
  db/          schema.sql, seed.sql
  docs/        class diagrams, api.md
```

## 8. Environment variables

```
# backend/.env
PORT=4000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # backend only, never in frontend, never committed
LOCK_TTL_SECONDS=300
THEATRE_UTC_OFFSET_MINUTES=330

# frontend/.env
VITE_API_URL=/api            # Vite dev proxy / nginx forward /api to the backend
BACKEND_URL=http://localhost:4000
```

## 9. Conventions

- Small, readable files. One class per header/source pair in C++.
- No secrets in code or Git. Provide .env.example only.
- Every stage ends with something runnable or testable.
- Do not change the JSON contract or API without updating this file.

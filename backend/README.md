# Backend

Node.js/Express API and bridge to the C++ booking engine.

## Build and smoke test the C++ engine

From this directory, install the Node dependencies and build the native addon:

```sh
npm install
npm run build:core
npm run smoke:core
```

The addon is built at `core/build-node/Release/bookmyshow_addon.node`. The engine wrapper in `src/engine/engine.js` converts JavaScript objects to JSON strings for the addon and parses its JSON string results.

### Windows prerequisites

- Visual Studio Build Tools with the **Desktop development with C++** workload and a Windows SDK.
- CMake available on `PATH`.
- Python 3 available on `PATH`.
- Node.js and npm.

Run the commands above from a terminal configured for the Visual Studio C++ toolchain.

## Express API

Copy `.env.example` to `.env`, then set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from the Supabase project settings and set a strong
random `JWT_SECRET`. Keep the service role key on the backend and out of source
control. Set `FRONTEND_ORIGIN` when the browser app is hosted at a non-default
origin. If upgrading an existing database, apply the `password_hash` column
addition in `../db/schema.sql`. Start the API from this directory:

```sh
npm install
npm run build:core
npm start
```

The read endpoints return JSON. `city` accepts either a city name or city UUID;
`date` is optional and uses `YYYY-MM-DD`.

```sh
curl http://localhost:4000/api/cities
curl 'http://localhost:4000/api/movies?city=Pune'
CITY_ID='replace-with-city-uuid'
MOVIE_ID='replace-with-movie-uuid'
SHOW_ID='replace-with-show-uuid'
curl "http://localhost:4000/api/movies?city=$CITY_ID"
curl "http://localhost:4000/api/movies/$MOVIE_ID/shows?date=2026-10-15"
curl "http://localhost:4000/api/shows/$SHOW_ID/seats"
```

Errors use the shape `{ "error": "message" }`. The seat map is hydrated into
the in-memory C++ engine on its first request, using the show's seats and
confirmed bookings from Supabase. Booking and seat-lock writes require an
`Authorization: Bearer <token>` header. Register at `/api/auth/register` with
`name`, `email`, `phone`, and `password`; login at `/api/auth/login` with
`email` and `password` to receive a JWT.

Run the Supertest suite with `npm test`. It covers registration, a confirmed
booking, booking ownership, a two-user seat-lock race, and database failure
compensation after payment.

Example protected booking requests (set `TOKEN`, `SHOW_ID`, and `SEAT_ID` from
the registration and show responses):

```sh
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Asha Rao","email":"asha@example.com","phone":"555-0101","password":"a-strong-password"}'
curl -X POST "http://localhost:4000/api/shows/$SHOW_ID/lock" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"seatIds\":[\"$SEAT_ID\"]}"
curl -X POST http://localhost:4000/api/bookings \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"showId\":\"$SHOW_ID\",\"seatIds\":[\"$SEAT_ID\"]}"
curl -X POST "http://localhost:4000/api/bookings/$BOOKING_ID/pay" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"CARD"}'
```

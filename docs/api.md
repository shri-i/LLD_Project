# REST API

Base URL: `http://localhost:4000/api` (or `/api` through the frontend's dev proxy). Routes and validation are documented from `backend/src/routes/` and `backend/src/controllers/`. JSON errors use `{ "error": "message" }`. Protected endpoints require `Authorization: Bearer <JWT>`.

## Public routes

| Method | Path | Query/body | Success |
|---|---|---|---|
| `GET` | `/cities` | — | `200`, array of `{ id, name }` |
| `GET` | `/movies?city=<name-or-uuid>` | `city` required | `200`, movies in the selected city |
| `GET` | `/movies/:id/shows` | Optional `date=YYYY-MM-DD` | `200`, shows with screen, theatre, address, and city |
| `GET` | `/shows/:id/seats` | — | `200`, engine seat map with status and price |
| `POST` | `/auth/register` | `{ "name", "email", "phone", "password" }` | `201`, `{ user, token }` |
| `POST` | `/auth/login` | `{ "email", "password" }` | `200`, `{ user, token }` |

IDs in path parameters must be UUIDs. Registration validates name (1–120 chars), email, phone (3–40 chars), and password (8–72 bytes). Login returns `401` for invalid credentials. Duplicate registration returns `409`.

## Authenticated routes

| Method | Path | JSON body | Success |
|---|---|---|---|
| `POST` | `/shows/:id/lock` | `{ "seatIds": ["<seat-uuid>"] }` | `200`, `{ ok: true, expiresAt }` |
| `POST` | `/shows/:id/unlock` | `{ "seatIds": ["<seat-uuid>"] }` | `200`, `{ ok: true }` |
| `POST` | `/bookings` | `{ "showId": "<show-uuid>", "seatIds": ["<seat-uuid>"] }` | `201`, `{ bookingId, status: "PENDING", totalAmount }` |
| `POST` | `/bookings/:id/pay` | `{ "mode": "CARD" }` (also `UPI`, `NET_BANKING`) | `200`, `{ bookingId, status: "CONFIRMED", paymentId }` |
| `POST` | `/bookings/:id/cancel` | Empty body | `200`, booking cancellation result |
| `GET` | `/users/:id/bookings` | — | `200`, user's bookings with seat and payment details |

Seat ID arrays must be non-empty, contain UUIDs, and contain no duplicates. A user can only view and modify their own bookings. The booking history route returns `403` for a different user ID.

## Errors

| Status | Meaning |
|---|---|
| `400` | Invalid JSON, body, UUID, or query value |
| `401` | Missing/invalid JWT or invalid login credentials |
| `403` | Authenticated user attempted to access another user's history |
| `404` | Route, city, movie, show, or booking not found |
| `409` | Seat conflict, expired/unowned lock, duplicate account, failed payment, or invalid booking state |
| `500` | Unexpected server or persistence failure |

## Example booking sequence

```sh
API=http://localhost:4000/api
TOKEN='JWT returned by register or login'
SHOW_ID='show UUID'
SEAT_ID='seat UUID'

curl -X POST "$API/shows/$SHOW_ID/lock" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"seatIds\":[\"$SEAT_ID\"]}"

curl -X POST "$API/bookings" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"showId\":\"$SHOW_ID\",\"seatIds\":[\"$SEAT_ID\"]}"

curl -X POST "$API/bookings/BOOKING_UUID/pay" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"CARD"}'

curl "$API/users/USER_UUID/bookings" -H "Authorization: Bearer $TOKEN"
curl -X POST "$API/bookings/BOOKING_UUID/cancel" -H "Authorization: Bearer $TOKEN"
```

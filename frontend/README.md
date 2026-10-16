# Frontend

React and Vite movie browser for the BookMyShow project.

## Run locally

Copy `.env.example` to `.env` and set `VITE_API_URL` to the backend API base
(by default, `http://localhost:4000/api`). Then run:

```sh
npm install
npm run dev
```

Create a production build with `npm run build`. The app uses the backend city,
movie, and show read endpoints. The movie details page groups showtimes by
theatre and calendar date. Selecting a show opens its live seat map; signing in
is required before the app locks selected seats. Seat holds continue into the
checkout summary and release when the timer expires or the page is left.

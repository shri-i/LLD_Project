-- BookMyShow schema for Supabase/Postgres.

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS theatres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    CONSTRAINT theatres_city_name_unique UNIQUE (city_id, name)
);

CREATE TABLE IF NOT EXISTS screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theatre_id UUID NOT NULL REFERENCES theatres(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    CONSTRAINT screens_theatre_name_unique UNIQUE (theatre_id, name)
);

CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
    row_label TEXT NOT NULL CHECK (row_label ~ '^[A-Z]$'),
    seat_number INTEGER NOT NULL CHECK (seat_number BETWEEN 1 AND 12),
    seat_type TEXT NOT NULL CHECK (seat_type IN ('REGULAR', 'PREMIUM', 'VIP')),
    CONSTRAINT seats_screen_position_unique UNIQUE (screen_id, row_label, seat_number)
);

CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL UNIQUE,
    duration_mins INTEGER NOT NULL CHECK (duration_mins > 0),
    language TEXT NOT NULL,
    genre TEXT NOT NULL,
    poster_url TEXT
);

CREATE TABLE IF NOT EXISTS shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE RESTRICT,
    screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    CONSTRAINT shows_end_after_start CHECK (end_time > start_time),
    CONSTRAINT shows_screen_start_unique UNIQUE (screen_id, start_time)
);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_seats (
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE RESTRICT,
    show_id UUID NOT NULL REFERENCES shows(id) ON DELETE RESTRICT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    PRIMARY KEY (booking_id, seat_id),
    CONSTRAINT booking_seats_show_seat_unique UNIQUE (show_id, seat_id)
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    mode TEXT NOT NULL CHECK (mode IN ('CARD', 'UPI', 'NET_BANKING')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theatres_city_id_idx ON theatres(city_id);
CREATE INDEX IF NOT EXISTS screens_theatre_id_idx ON screens(theatre_id);
CREATE INDEX IF NOT EXISTS seats_screen_position_idx ON seats(screen_id, row_label, seat_number);
CREATE INDEX IF NOT EXISTS shows_movie_start_time_idx ON shows(movie_id, start_time);
CREATE INDEX IF NOT EXISTS shows_screen_start_time_idx ON shows(screen_id, start_time);
CREATE INDEX IF NOT EXISTS bookings_user_created_at_idx ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_show_id_idx ON bookings(show_id);
CREATE INDEX IF NOT EXISTS booking_seats_booking_id_idx ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS payments_booking_created_at_idx ON payments(booking_id, created_at DESC);

-- Row Level Security: with RLS on and no policies, Supabase's public anon and
-- authenticated roles cannot read or write these tables through the REST API.
-- The backend uses the service-role key, which bypasses RLS.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatres ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Sample users, locations, screens, seats, movies, and screenings.
-- Shows are generated for today and the following two calendar days.
-- Slot times (10:00, 14:00, 19:00) are India Standard Time.

INSERT INTO cities (id, name) VALUES
    ('10000000-0000-4000-8000-000000000001', 'Pune'),
    ('10000000-0000-4000-8000-000000000002', 'Mumbai'),
    ('10000000-0000-4000-8000-000000000003', 'Bengaluru')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO theatres (id, city_id, name, address) VALUES
    ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'PVR Pavilion Mall', 'Senapati Bapat Road, Pune'),
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'INOX Bund Garden', 'Bund Garden Road, Pune'),
    ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'PVR Juhu', 'Juhu Tara Road, Mumbai'),
    ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'INOX R City', 'Lal Bahadur Shastri Road, Mumbai'),
    ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'PVR Orion Mall', 'Dr Rajkumar Road, Bengaluru'),
    ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'INOX Garuda Mall', 'Magrath Road, Bengaluru')
ON CONFLICT (id) DO UPDATE SET
    city_id = EXCLUDED.city_id,
    name = EXCLUDED.name,
    address = EXCLUDED.address;

INSERT INTO screens (id, theatre_id, name) VALUES
    ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Screen 1'),
    ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Screen 2'),
    ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Screen 1'),
    ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'Screen 2'),
    ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'Screen 1'),
    ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 'Screen 2'),
    ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000004', 'Screen 1'),
    ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000004', 'Screen 2'),
    ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000005', 'Screen 1'),
    ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000005', 'Screen 2'),
    ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000006', 'Screen 1'),
    ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000006', 'Screen 2')
ON CONFLICT (id) DO UPDATE SET theatre_id = EXCLUDED.theatre_id, name = EXCLUDED.name;

INSERT INTO seats (screen_id, row_label, seat_number, seat_type)
SELECT screen.id,
       chr(64 + row_number)::TEXT,
       seat_number,
       CASE
           WHEN seat_number <= 6 THEN 'REGULAR'
           WHEN seat_number <= 10 THEN 'PREMIUM'
           ELSE 'VIP'
       END
FROM screens AS screen
CROSS JOIN generate_series(1, 10) AS rows(row_number)
CROSS JOIN generate_series(1, 12) AS seat_numbers(seat_number)
ON CONFLICT (screen_id, row_label, seat_number)
DO UPDATE SET seat_type = EXCLUDED.seat_type;

INSERT INTO movies (id, title, duration_mins, language, genre, poster_url) VALUES
    ('40000000-0000-4000-8000-000000000001', 'The Last Monsoon', 132, 'Hindi', 'Drama', 'https://example.com/posters/last-monsoon.jpg'),
    ('40000000-0000-4000-8000-000000000002', 'Orbit Breakers', 148, 'English', 'Science Fiction', 'https://example.com/posters/orbit-breakers.jpg'),
    ('40000000-0000-4000-8000-000000000003', 'Chai and Chapters', 116, 'Hindi', 'Romance', 'https://example.com/posters/chai-chapters.jpg'),
    ('40000000-0000-4000-8000-000000000004', 'The Silent Fort', 139, 'Marathi', 'Thriller', 'https://example.com/posters/silent-fort.jpg'),
    ('40000000-0000-4000-8000-000000000005', 'Neon Bengaluru', 125, 'Kannada', 'Action', 'https://example.com/posters/neon-bengaluru.jpg'),
    ('40000000-0000-4000-8000-000000000006', 'Blue Planet, Deep Sky', 101, 'English', 'Documentary', 'https://example.com/posters/blue-planet.jpg'),
    ('40000000-0000-4000-8000-000000000007', 'A Summer in Colaba', 128, 'Hindi', 'Comedy', 'https://example.com/posters/summer-colaba.jpg'),
    ('40000000-0000-4000-8000-000000000008', 'Paper Kingdom', 143, 'Tamil', 'Fantasy', 'https://example.com/posters/paper-kingdom.jpg')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    duration_mins = EXCLUDED.duration_mins,
    language = EXCLUDED.language,
    genre = EXCLUDED.genre,
    poster_url = EXCLUDED.poster_url;

INSERT INTO users (id, name, email, phone) VALUES
    ('50000000-0000-4000-8000-000000000001', 'Aarav Mehta', 'aarav.mehta@example.test', '+919800000101'),
    ('50000000-0000-4000-8000-000000000002', 'Mira Kulkarni', 'mira.kulkarni@example.test', '+919800000102'),
    ('50000000-0000-4000-8000-000000000003', 'Kabir Rao', 'kabir.rao@example.test', '+919800000103')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone;

WITH numbered_screens AS (
    SELECT id, row_number() OVER (ORDER BY id)::INTEGER AS screen_number
    FROM screens
), schedule AS (
    SELECT day_offset,
           (now() AT TIME ZONE 'Asia/Kolkata')::DATE + day_offset AS show_date,
           slot_time,
           slot_number
    FROM generate_series(0, 2) AS days(day_offset)
    CROSS JOIN (VALUES
        (TIME '10:00', 1),
        (TIME '14:00', 2),
        (TIME '19:00', 3)
    ) AS slots(slot_time, slot_number)
)
INSERT INTO shows (movie_id, screen_id, start_time, end_time, base_price)
SELECT movie.id,
       numbered_screens.id,
       (schedule.show_date + schedule.slot_time) AT TIME ZONE 'Asia/Kolkata',
       (schedule.show_date + schedule.slot_time) AT TIME ZONE 'Asia/Kolkata'
           + make_interval(mins => movie.duration_mins + 20),
       CASE WHEN schedule.slot_number = 3 THEN 350.00 ELSE 250.00 END
FROM numbered_screens
CROSS JOIN schedule
CROSS JOIN LATERAL (
    SELECT candidate.id, candidate.duration_mins
    FROM movies AS candidate
    ORDER BY candidate.id
    OFFSET ((numbered_screens.screen_number + schedule.day_offset + schedule.slot_number - 2) % 8)
    LIMIT 1
) AS movie
ON CONFLICT (screen_id, start_time) DO UPDATE SET
    movie_id = EXCLUDED.movie_id,
    end_time = EXCLUDED.end_time,
    base_price = EXCLUDED.base_price;

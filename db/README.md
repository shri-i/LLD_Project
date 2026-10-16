# Database

Contains the Supabase/Postgres schema and repeatable sample data.

## Run in Supabase

1. Open the project’s **SQL Editor** in the Supabase dashboard.
2. Open `schema.sql`, paste its contents into a new query, and run it first.
3. Open `seed.sql`, paste its contents into a second query, and run it after the schema succeeds.

The seed inserts three cities, six theatres, twelve screens with 120 seats each, eight movies, three sample users, and shows scheduled for today and the following two days. It is safe to run again: fixed sample records are upserted, and seats and shows use their natural unique keys.

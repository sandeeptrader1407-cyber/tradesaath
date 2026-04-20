# Supabase Database

The database schema is defined by the migration files in `migrations/`.

Run them in order (001, 002, ...) against your Supabase project's SQL editor.

**Do not** add a monolithic `schema.sql` — it drifts from the migrations and causes confusion.

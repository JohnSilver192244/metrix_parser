# Supabase Setup Notes

This project uses `Supabase Postgres` as the single persistent store for the MVP.

## Naming Conventions

- All tables must use `snake_case`
- All columns must use `snake_case`
- Foreign keys should follow the `<entity>_id` pattern
- API and frontend DTOs stay in `camelCase`; mapping must be explicit at the backend boundary

## Boundaries

- `apps/web` must never talk to Supabase directly
- `apps/api` is the only backend boundary for the frontend
- `apps/worker` may persist imported data to Supabase as part of ingestion flows

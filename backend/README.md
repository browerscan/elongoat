# Backend (Ops + Data Pipelines)

The main web app lives in `src/` (Next.js App Router). This `backend/` directory contains:

- Supabase/Postgres schema + SQL
- One-off import scripts for CSV datasets
- Optional workers (video / X monitoring) that run on a schedule

Nothing in `backend/` is required to run the site locally; it exists to make production operations repeatable.

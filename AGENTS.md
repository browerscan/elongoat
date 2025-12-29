# Repository Guidelines

## Project Structure

- `src/app/`: Next.js App Router pages + API routes (`src/app/api/*`)
- `src/components/`: React UI components (Tailwind)
- `src/lib/`: core logic (chat, indexes, caching, DB helpers)
- `data/`: source CSVs; `data/generated/`: generated JSON indexes (do not hand-edit)
- `backend/`: ops/data pipelines (Supabase schema, import scripts, workers)
- `tests/`: Vitest tests (`*.test.ts`, plus `tests/stubs/`)
- `public/`: static assets; `docs/`: architecture/ops notes (see `docs/OPS.md`)

Generated artifacts like `.next/`, `next-app/`, and `node_modules/` are not source.

## Build, Test, and Development Commands

- `npm install`: install dependencies
- `cp .env.example .env.local`: create local env; set `VECTORENGINE_API_KEY` for `/api/chat`
- `npm run generate:indexes`: CSV → `data/generated/*.json` (also runs via `predev`/`prebuild`)
- `npm run dev`: run the app at `http://localhost:3000`
- `npm run build` / `npm start`: production build + run
- `npm run lint`: ESLint (Next.js core-web-vitals + TypeScript rules)
- `npm test` / `npm run test:watch` / `npm run test:coverage`: Vitest

Optional local services: `docker compose -f docker-compose.dev.yml up -d` (Postgres + Redis).

## Coding Style & Naming Conventions

- TypeScript + React; match existing formatting (2-space indentation, double quotes, semicolons).
- Components: `PascalCase.tsx` in `src/components/`; utilities: `camelCase.ts` in `src/lib/`.
- Prefer `@/…` path aliases over relative import chains.

## Testing Guidelines

- Keep tests in `tests/` and name files `*.test.ts`.
- Write deterministic tests; stub external services (Redis/DB) where practical.

## Commit & Pull Request Guidelines

- No git history is shipped with this repo snapshot; use Conventional Commits (e.g., `feat: …`, `fix: …`).
- PRs: include a short description, how to test, and screenshots for UI changes; call out any env var changes.

## Security & Configuration Tips

- Never commit real secrets; use `.env.local` (gitignored).
- Treat `VECTORENGINE_API_KEY` as server-only; ops/workers may require `DATABASE_URL`, `REDIS_URL`.

## Agent-Specific Notes (Codex)

- Use a named skill when the user explicitly requests it; keep context small and prefer existing scripts in `scripts/`/`backend/scripts/`.

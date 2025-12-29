# ElonGoat

ElonGoat is a sci‑fi themed, SEO-first site + streaming chat widget built from:

- `data/elon-musk_clusters.csv` → topic hubs + keyword pages
- `data/google-paa-elon-musk-level8-23-12-2025.csv` → Q&A pages

Disclaimer: this project is **not affiliated** with Elon Musk or any of his companies. The chat is an **AI simulation**, not the real person.

## Local dev

1. Install deps:

```bash
npm install
```

2. Create env:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `VECTORENGINE_API_KEY` (server-only).

3. Generate indexes (CSV → JSON):

```bash
npm run generate:indexes
```

4. Run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Key routes

- `/topics` → all topic hubs
- `/:topic` → a topic hub (from clusters)
- `/:topic/:page` → a keyword page (from clusters)
- `/q` → Q&A index
- `/q/:slug` → Q&A page
- `/videos` → video index (SOAX ingest + optional transcripts)
- `/x` → cached X timeline mirror (requires DB ingest)
- `/x/following` → optional following list (best-effort scraping; may be incomplete)
- `/facts` → dynamic variables (age, etc.)
- `/admin` → token-protected admin tools (flywheel + hot config)
- `/api/chat` → streaming SSE (server-only VectorEngine key)
- `/api/variables` → cached variables JSON

## Workers

- X ingest (tweets, optional following): `DATABASE_URL=... npm run worker:x`
- Videos ingest (Google Videos): `SOAX_API_SECRET=... DATABASE_URL=... npm run worker:videos`

## Deploy (VPS / nginx-proxy)

- Build + run with Docker:
  - `Dockerfile` uses Next.js `output: "standalone"`.
  - `docker-compose.yml` joins `nginx-proxy_default` and `supabase_default`.

See `docs/OPS.md` for the production playbook (cron/workers, safety).

## Safety

- Never commit real keys; use `.env.local` (gitignored).
- Chat is ephemeral (no DB history stored).

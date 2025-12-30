# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ElonGoat is an SEO-first site with a streaming AI chat widget, deployed with **frontend/backend split architecture**:

- **Frontend**: Static export → Cloudflare Pages (elongoat.io)
- **Backend**: API server → VPS Docker (api.elongoat.io)

Content is generated from:

- Keyword clusters (topic hubs + keyword pages)
- Google PAA (People Also Ask) Q&A pages
- X timeline mirror (optional, best-effort scraping)
- YouTube video pages (SOAX ingest + optional transcripts)

**Disclaimer**: Not affiliated with Elon Musk. Chat is an AI simulation.

## Commands

```bash
# Development
npm run generate:indexes     # CSV -> JSON indexes (auto-runs on dev/build)
npm run dev                  # Start dev server (port 3000)
npm run build                # Production build
npm run lint                 # ESLint
npm run test                 # Vitest (single run)
npm run test:watch           # Vitest (watch mode)

# Database (requires DATABASE_URL)
npm run db:apply-schema      # Apply PostgreSQL schema
npm run db:import:all        # Import all data (clusters + PAA + metrics)
npm run db:seed:variables    # Seed dynamic variables

# Workers (run separately with env vars)
DATABASE_URL=... npm run worker:x        # X/Twitter ingest
SOAX_API_SECRET=... DATABASE_URL=... npm run worker:videos  # Video ingest

# Docker deployment
make deploy       # Validate + build + deploy
make down         # Stop services
make logs         # Tail logs
make restart      # down + deploy
make health       # Check /api/health
make db-schema    # Apply schema via psql
```

## Architecture (Frontend/Backend Split)

```
FRONTEND (Cloudflare Pages - elongoat.io)
├── Static HTML pages (pre-built from API)
├── Client-side JS (React hydration)
└── API calls to backend for:
    - Chat streaming (/api/chat)
    - Dynamic content (on-demand)

BACKEND (VPS Docker - api.elongoat.io)
├── API Routes
│   ├── /api/data/*      # Data APIs (cluster, topic, page, qa)
│   ├── /api/chat        # Streaming SSE chat (VectorEngine)
│   ├── /api/variables   # Dynamic variables
│   └── /api/admin/*     # Admin endpoints
├── Database (PostgreSQL via Supabase)
├── Cache (Redis)
└── Background workers

src/
├── app/                      # Next.js App Router pages
│   ├── [topic]/[page]/       # Dynamic keyword pages from clusters
│   ├── q/[slug]/             # Q&A pages from PAA data
│   ├── videos/[videoId]/     # Video detail pages
│   ├── x/                    # X timeline mirror
│   ├── admin/                # Token-protected admin panel
│   └── api/
│       ├── data/             # Data APIs for frontend
│       ├── chat/route.ts     # Streaming SSE chat (VectorEngine)
│       ├── variables/        # Cached dynamic variables
│       └── admin/            # Admin endpoints (auth, content gen)
├── components/               # React components (ChatWidget, etc.)
└── lib/
    ├── apiClient.ts          # Frontend API client (fetch from backend)
    ├── indexes.ts            # Cluster/PAA index loaders (server-only)
    ├── db.ts                 # PostgreSQL pool (pg)
    ├── redis.ts              # Redis client (ioredis)
    ├── vectorengine.ts       # VectorEngine API client
    ├── buildSystemPrompt.ts  # Chat persona prompt builder
    ├── variables.ts          # Dynamic vars (age, net_worth, etc.)
    └── tieredCache.ts        # L1 (memory) + L2 (Redis) cache

backend/
├── scripts/                  # DB import/migration scripts (tsx)
│   ├── apply_schema.ts
│   ├── import_clusters.ts
│   ├── import_paa.ts
│   └── warm_content.ts       # Pre-warm content cache
├── workers/                  # Background workers
│   ├── ingest_x.ts           # X/Twitter scraping (SOAX)
│   └── ingest_videos.ts      # Video scraping (SOAX)
└── lib/                      # Shared backend utilities

scripts/                      # Python scripts
└── generate_indexes.py       # CSV -> JSON index generator

data/
├── *.csv                     # Source data (clusters, PAA, metrics)
└── generated/                # JSON indexes (gitignored, auto-generated)
```

## Data Flow

1. **Build time**: `generate_indexes.py` converts CSVs to JSON indexes
2. **Runtime**: `src/lib/indexes.ts` loads JSON into memory (server-only)
3. **Database** (optional): PostgreSQL stores videos, X tweets, custom Q&A, analytics
4. **Cache**: L1 memory + L2 Redis, with semantic caching for chat responses

## Key Patterns

- All DB/API access uses `"server-only"` import guard
- Chat uses SSE streaming with fallback responses when VectorEngine is unavailable
- Rate limiting via Redis (20 chat messages/hour/IP default)
- Dynamic variables (age, children_count, net_worth) can be hot-updated via DB
- Content generation uses VectorEngine with configurable models

## Deployment

Two separate deployments via GitHub Actions:

```bash
# Frontend (Cloudflare Pages)
# Triggered by .github/workflows/deploy-frontend.yml
# Uses next.config.mjs (output: "export")
npm run build  # Outputs to /out folder

# Backend (VPS Docker)
# Triggered by .github/workflows/deploy-backend.yml
# Uses next.config.backend.mjs (output: "standalone")
make deploy    # On VPS
```

## Environment Variables

Copy `.env.example` to `.env.local`. Critical vars:

**Frontend (build time):**

- `NEXT_PUBLIC_SITE_URL` - Site URL (https://elongoat.io)
- `NEXT_PUBLIC_API_URL` - Backend API URL (https://api.elongoat.io)

**Backend:**

- `VECTORENGINE_API_KEY` - Required for chat (server-only)
- `DATABASE_URL` - PostgreSQL with `?schema=elongoat`
- `REDIS_URL` - For rate limiting and caching
- `ELONGOAT_ADMIN_TOKEN` - Required for /admin endpoints

## Docker Deployment (Backend)

Uses `nginx-proxy_default`, `supabase_default`, and `redis_default` external networks. Container name: `standalone-elongoat`.

## Key Routes

| Route           | Description                   |
| --------------- | ----------------------------- |
| `/topics`       | All topic hubs                |
| `/:topic`       | Topic hub page                |
| `/:topic/:page` | Keyword page                  |
| `/q`            | Q&A index                     |
| `/q/:slug`      | Q&A detail                    |
| `/videos`       | Video index                   |
| `/x`            | X timeline mirror             |
| `/admin`        | Admin panel (token-protected) |
| `/api/chat`     | Streaming chat endpoint       |

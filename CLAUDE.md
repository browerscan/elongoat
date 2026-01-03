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

# Content Generation (requires DATABASE_URL + /codex skill)
npm run generate:all-clusters  # Generate ALL 73,550 cluster pages (6 parallel threads, 1200+ words each)
npm run generate:questions     # Generate PAA questions (default: top 1000 by volume, 800+ words each)
npm run generate:questions -- --min-volume 100 --limit 5000  # Custom filters

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
│   ├── /api/metrics     # Prometheus-compatible metrics
│   ├── /api/health      # Health check with component status
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

## RAG Content Generation System

ElonGoat uses a hybrid RAG (Retrieval-Augmented Generation) system for high-quality content:

**Architecture:**

- RAG query engine: `src/lib/rag.ts`
- Content generation: `src/lib/contentGenEnhanced.ts`
- Codex integration: `backend/lib/codex.ts`
- Batch processing: 6 parallel threads via `/codex` skill

**Data Sources & Weights:**

1. **Content Cache** (weight 1.0): Previously generated high-quality content
2. **PAA Tree** (weight 0.6): Google "People Also Ask" data with answers
3. **Cluster Pages** (weight 0.3): Site architecture and keyword mapping

**Generation Pipeline:**

1. Query builds RAG context from all sources using PostgreSQL full-text search
2. Prompt combines: page metadata + top keywords + RAG contexts + dynamic variables
3. `/codex` skill generates 1200+ word articles (clusters) or 800+ word answers (PAA)
4. Word count validation (warnings only, no retries)
5. Results cached to `content_cache` table with 30-day TTL

**Progress Tracking:**

- Cluster generation: `data/generated/cluster_generation_progress.json`
- Question generation: `data/generated/question_generation_progress.json`
- Both support resume on interruption (checks DB for existing content)

**Quality Targets:**

- Cluster pages: 1200+ words minimum
- PAA answers: 800+ words minimum
- Structured markdown with proper headings
- Timeframes cited for all facts
- SEO-optimized with natural keyword integration

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

| Route           | Description                        |
| --------------- | ---------------------------------- |
| `/topics`       | All topic hubs                     |
| `/:topic`       | Topic hub page                     |
| `/:topic/:page` | Keyword page                       |
| `/q`            | Q&A index                          |
| `/q/:slug`      | Q&A detail                         |
| `/videos`       | Video index                        |
| `/x`            | X timeline mirror                  |
| `/admin`        | Admin panel (token-protected)      |
| `/api/chat`     | Streaming chat endpoint            |
| `/api/metrics`  | Prometheus metrics (optional auth) |
| `/api/health`   | Health check with latency          |

## Monitoring & Metrics

The backend exposes Prometheus-compatible metrics at `/api/metrics`:

```bash
# Without auth (if METRICS_TOKEN is not set)
curl https://api.elongoat.io/api/metrics

# With auth (if METRICS_TOKEN is set)
curl -H "Authorization: Bearer $METRICS_TOKEN" https://api.elongoat.io/api/metrics
```

**Available Metrics:**

| Metric                         | Type  | Description                     |
| ------------------------------ | ----- | ------------------------------- |
| `nodejs_heap_used_bytes`       | gauge | Process heap memory used        |
| `db_pool_utilization_percent`  | gauge | Database pool utilization       |
| `redis_latency_ms`             | gauge | Redis ping latency              |
| `cache_hit_rate`               | gauge | Overall cache hit rate (0-1)    |
| `http_request_duration_p95_ms` | gauge | 95th percentile request latency |
| `http_error_rate`              | gauge | HTTP error rate (0-1)           |

**Cache Warmup:**

On container startup, the entrypoint script automatically warms critical caches:

```bash
# Environment variables
WARMUP_DELAY_MS=10    # Delay before warmup (seconds)
SKIP_WARMUP=0         # Set to 1 to disable warmup
```

**Docker Resource Limits:**

```yaml
# docker-compose.yml
mem_limit: 1024m
memswap_limit: 1536m
cpus: 2.0
```

## RAG API

Production-ready RAG search API with authentication, rate limiting, and caching.

**Authentication:** `X-API-Key` header with `ELONGOAT_RAG_API_KEY`

| Endpoint                 | Method | Description                                   |
| ------------------------ | ------ | --------------------------------------------- |
| `/api/rag/search`        | POST   | Full-text search across all sources           |
| `/api/rag/hybrid`        | POST   | Hybrid search (full-text + vector similarity) |
| `/api/rag/article/:slug` | GET    | Get full article by slug                      |
| `/api/rag/stats`         | GET    | Knowledge base statistics                     |
| `/api/rag/topics`        | GET    | List all topics with counts                   |
| `/api/rag/health`        | GET    | Health check (no auth required)               |
| `/api/rag/cache`         | GET    | Cache statistics                              |
| `/api/rag/cache`         | DELETE | Clear all cache                               |

**Search Request:**

```json
{
  "query": "elon musk net worth",
  "sources": ["content_cache", "paa", "cluster"],
  "limit": 10,
  "min_score": 0.01,
  "full_text_weight": 0.5, // hybrid only
  "semantic_weight": 0.5 // hybrid only
}
```

**Rate Limits:**

- Search: 100 req/min
- Article: 200 req/min
- Stats/Topics: 60 req/min

**Vector Search Setup:**

```bash
# Apply pgvector migration
npm run db:apply-vectors

# Generate embeddings (requires OPENAI_API_KEY)
npm run generate:embeddings
npm run generate:embeddings -- --table content_cache --skip-existing
```

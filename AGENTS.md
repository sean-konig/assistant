# Agents overview

This repo implements a small set of “agents” that operate over user data via a NestJS API and a Postgres database with pgvector. Rather than long‑running background workers, agents are currently exposed as API endpoints that can be triggered by the client or queued as simple jobs. This document explains what exists today and how to extend it.

## Architecture at a glance

- Runtime: NestJS (Fastify) in `apps/api`
- Data: Postgres 16 with Prisma. Vector search enabled by pgvector
- Monorepo: pnpm + Turborepo, Next.js app in `apps/web`
- Auth: Supabase-style JWT guard (`SupabaseJwtGuard`) protecting agent endpoints
- Models: Users, Projects, Sources, Items, Embeddings, RiskScores, Digests, Reminders, JobRuns

Database schema lives in `apps/api/prisma/schema.prisma`. pgvector is required and enabled by the first migration. Embeddings are stored as Postgres `vector(1536)` using a raw SQL insert to ensure the column type is honored.

## Existing agents

### 1) Embeddings indexer

- Module: `apps/api/src/embeddings`
- Endpoint: `POST /embeddings/index` (JWT required)
- Purpose: Store a user‑scoped vector embedding, optionally linked to an `Item`
- Service method: `EmbeddingsService.indexVector(userId, itemId, vector, dim)`
- Storage: Inserts into `Embedding` with `vector` as `vector(1536)` (or provided dim)

Request body example:

```
{
  "itemId": "<optional item id>",
  "vector": [0.01, -0.12, ...],
  "dim": 1536
}
```

Response: Newly created `Embedding` row id and metadata

Notes:

- The service uses raw SQL via Prisma to cast the JSON array to `vector` type: `[v1,v2,...]::vector`
- Ensure pgvector extension is installed and migrations have been applied

### 2) Daily digest generator

- Module: `apps/api/src/digests`
- Endpoint: `POST /digests/generate` (JWT required)
- Purpose: Generate and persist a per‑user daily digest summary
- Service method: `DigestsService.generate(userId, date)`
- Storage: Creates a `Digest` row with a simple string summary

Request body example:

```
{
  "date": "2025-09-15"
}
```

Response: Newly created `Digest` row

Notes:

- Current implementation is simple and not LLM‑powered. It aggregates today’s items and writes a placeholder summary. You can wire an LLM later and store provenance in `Digest` or a related table.

### 3) Job queue (lightweight)

- Module: `apps/api/src/jobs`
- Endpoint: `POST /jobs/queue` (JWT required)
- Purpose: Persist a queued job request describing work to be done
- Service method: `JobsService.queue(userId, kind, details?)`
- Storage: Creates a `JobRun` row with `status = 'queued'`

Request body example:

```
{
  "kind": "compute-digest",
  "details": { "date": "2025-09-15" }
}
```

Response: Newly created `JobRun` row. Processing is not yet attached to a worker.

Notes:

- This is a staging point for attaching a worker (BullMQ, Nest Bull, or a serverless cron) later. For now, it’s a durable TODO list in the DB.

## Data model highlights

Key tables (see `schema.prisma`):

- `users` — user registry (mirrors Supabase auth IDs)
- `projects`, `sources`, `items` — content graph
- `embeddings` — vector store: `vector(1536)` column with dimension `dim`
- `digests` — daily summaries
- `job_runs` — simple job queue audit

Prisma client is extended in `apps/api/src/prisma/prisma.service.ts`.

## Auth

All agent endpoints are guarded by `SupabaseJwtGuard`. For local development, provide a valid bearer token or temporarily disable guards while iterating. The Swagger UI can be enabled via config in non‑production and includes the bearer security scheme.

## Local development

1. Start Postgres with pgvector
   - `docker-compose up -d`
2. Install deps and generate the Prisma client
   - `pnpm install`
   - `pnpm -C apps/api prisma:generate`
3. Apply migrations
   - `pnpm -C apps/api prisma:deploy` (or `prisma:migrate` during dev)
4. Run the API
   - `pnpm -C apps/api dev` (listens on :3002 by default)
5. Call endpoints with a JWT
   - `POST /embeddings/index`, `POST /digests/generate`, `POST /jobs/queue`

## Extending agents

- Add a new module under `apps/api/src/<agent>` with controller, service, and tests
- Persist state via Prisma models and add a migration
- If you need background execution, introduce a worker (e.g., BullMQ) and have controllers enqueue work in `job_runs`
- For vector work, keep using raw SQL casts when inserting to `vector` columns

## Roadmap ideas

- Background workers for `job_runs` using BullMQ or cron jobs
- Vector search endpoints (KNN over `embeddings`)
- LLM‑powered summarization for digests and item enrichment
- Alerts and reminders dispatchers

---

If anything here gets out of date, treat this as a living document and update alongside code changes.

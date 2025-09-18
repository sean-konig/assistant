# Prisma + Supabase migrations

We use Prisma Migrate against Supabase Postgres. The schema defines `Embedding.vector` as `Unsupported("vector(1536)")` and the initial migration enables the `pgvector` extension and creates the vector column.

## Environment

Set these in `apps/api/.env` (see `.env.example`):

- DATABASE_URL (pooled PgBouncer) — used by the app/runtime
- DIRECT_URL (direct 5432) — used by migrations

Example:

DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-1-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require

## Commands

- Generate client:
  pnpm --filter api prisma generate

- Create a new migration from schema changes:
  pnpm --filter api prisma migrate dev --name <change>

- Apply migrations in CI/prod:
  pnpm --filter api prisma migrate deploy

## Notes

- Supabase DB must have the `vector` extension available (enabled by the initial migration).
- If you get P1001 connection errors, verify DIRECT_URL host is db.<PROJECT_REF>.supabase.co and sslmode=require is set.
 - Embedding dimensions use OpenAI `text-embedding-3-small` (1536-d). Ensure the `embeddings.vector` column is `vector(1536)` and the `embeddings.dim` default is `1536`.

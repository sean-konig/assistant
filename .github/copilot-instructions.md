## Copilot instructions for this repo

This is a pnpm + Turborepo monorepo. The backend lives in `apps/api` (NestJS + Fastify + Prisma + Postgres/pgvector) and the frontend lives in `apps/web` (Next.js). Use the patterns below when adding code, wiring features, or writing tests.

### Architecture and boundaries

- API composition (see `apps/api/src/app.module.ts`): domain modules (Users, Projects, Sources, Items, Embeddings, Agents, Risks, Digests, Reminders, Jobs). Each module has a Controller and Service; inject `PrismaService` for DB access.
- Auth: Controllers that handle user data are protected with `@UseGuards(SupabaseJwtGuard)` and use `@GetUser()` to access `{ id, email, role }` extracted from a Supabase-style JWT (see `common/guards/supabase-jwt.guard.ts`).
- LLM: Use `OpenAiService` (`llm/openai.service.ts`) instead of calling OpenAI directly. Check `isEnabled()` before using in non‑prod.
- Vectors: Embeddings are stored in Postgres with pgvector. Write vectors using `EmbeddingsService.indexVector()` which casts `[v1,...]::vector` via raw SQL. Query with `<->` distance in raw SQL when needed.
- SSE chat: `CoreAgentController` exposes `GET /core/chat/stream` (Server‑Sent Events). For streaming in Fastify, write to `res.raw` and set CORS/SSE headers manually.

### Data model conventions (Prisma)

- Schema: `apps/api/prisma/schema.prisma`. Tables are pluralized via `@@map` (e.g., model `User` -> table `users`).
- Embeddings dimension: migrations set `embeddings.vector` to `vector(1536)` (see `prisma/migrations/20250916_vector_1536`). When inserting vectors, ensure the array length matches the column dimension. The default OpenAI embed model is `text-embedding-3-small` (1536 dims).
- Prefer Prisma for CRUD; use `$queryRawUnsafe`/`$executeRawUnsafe` only for vector casts/search.

### Developer workflows

- Install, run, and build from the repo root using turbo scripts in `package.json`:
  - Dev all apps: `pnpm dev`
  - Build all: `pnpm build`
  - Lint/types: `pnpm lint`, `pnpm check-types`
- API only:
  - Start Postgres locally: `docker-compose up -d` (defines `assistant_postgres` on port 5432)
  - Generate/apply Prisma: `pnpm -C apps/api prisma:generate`, `pnpm -C apps/api prisma:deploy`
  - Run API: `pnpm -C apps/api dev` (Fastify on :3002; CORS allows `APP_PUBLIC_URL` or `http://127.0.0.1:3000`)
  - Test: `pnpm -C apps/api test` (Vitest)
- Web only: `pnpm -C apps/web dev` (Next.js on :3000). The chat UI calls the SSE endpoint above.

### Configuration and env

- API env (see `src/config/app.config.ts` and `app.config.schema.ts`): `PORT` (default 3002), `DATABASE_URL`, `SWAGGER_ENABLED` (true in dev), `SUPABASE_PROJECT_URL`, `SUPABASE_JWKS_URL`. CORS uses `APP_PUBLIC_URL` when set.
- OpenAI: `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` (default `gpt-4o-mini`), `OPENAI_EMBED_MODEL` (default `text-embedding-3-small`).
- Prisma with Supabase (see `apps/api/prisma/README.md`): set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct 5432) in `apps/api/.env`.

### Patterns and examples

- Vector insert (handled by `EmbeddingsService`):
  - SQL shape: `INSERT ... VALUES (..., '[<comma-separated floats>]'::vector, 1536, now())`
- Vector search (see `ProjectAgent.qa`):
  - `ORDER BY e.vector <-> $2::vector LIMIT 5` where `$2` is `'[f1,...,f1536]'`
- SSE streaming (see `CoreAgentController.chatStream`):
  - Set `Content-Type: text/event-stream`, write `data: <json>\n\n`, and periodically send `: ping` comments.

### Adding features safely

- New agent/module: create `src/<feature>` folder with `*.module.ts`, `*.controller.ts`, `*.service.ts`; wire into `AppModule` if global.
- Use `OpenAiService` for any LLM calls; return markdown or typed JSON as shown in `summarizeNote`.
- For any new embeddings or search endpoints, enforce 1536‑dim vectors to match the column.
- Keep HTTP routes consistent with existing style: resource path + action (e.g., `POST /digests/generate`, `POST /jobs/queue`).

### Testing and development

- **NEVER create standalone test scripts** (e.g., `test-*.js`, `test-*.ts`). These are pointless and clutter the codebase.
- Write proper unit tests using Vitest in the `test/` directory or alongside modules with `.spec.ts` files.
- Use the built-in NestJS testing utilities and follow existing test patterns in the codebase.
- For API testing, use the existing e2e test framework in `apps/api/test/` directory.
- For quick verification during development, use the API endpoints directly via HTTP clients or the web UI.

Questions or unclear areas: Do you want Swagger enabled in dev by default, and should `/embeddings/index` enforce 1536 dims (controller default still mentions 768)? I can align docs/code if you confirm the intended dimension and default models.

# Exec Assistant — Build Sheet for Coding Agent

> **Purpose:** Concrete, copy‑pasteable instructions for our coding agent to implement the next features. Includes prompts, routes, DTOs, DB migrations, job specs, scoring rules, and acceptance tests.

---

## Scope (maps to the dashboard)

1. DB migrations for new tables we need now.
2. `/ingest/manual` endpoint + background job: normalize → chunk → embed → agent graph.
3. **Extractor**: create/update tasks from text.
4. **Prioritizer**: score + bucket tasks with reasoning.
5. **Summarizer**: daily digests per project and a global digest.
6. Wire dashboard cards to queries.
7. Quick Add UI (Note / Meeting / Action Items).
8. Admin **Rescore** button.

---

## Prompts (drop‑in)

### Shared System Prompt (use for all sub‑agents)

```
You are Exec Assistant’s back‑office agent. Be concise and practical. Use markdown. If unsure, say so and propose one next step. Default the task owner to "me" unless a different person is clearly specified. Keep answers scoped to the project unless asked for cross‑project view. Extract actionable items as a short checklist when relevant. Your outputs feed a higher‑level personal assistant that plans Sean’s day.
```

### Extractor Prompt

```
Goal: From the provided text, extract tasks as strict JSON using the schema. Default owner to "me" unless another owner is explicit.
Only output JSON.
```

**JSON Schema (validate before insert)**

```json
{
  "type": "object",
  "properties": {
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title"],
        "properties": {
          "title": {"type": "string"},
          "description": {"type": "string"},
          "owner": {"type": "string", "default": "me"},
          "due_date": {"type": ["string", "null"], "description": "ISO date or null"},
          "signals": {"type": "array", "items": {"type": "string"}},
          "source_ingest_event_id": {"type": "string"}
        }
      }
    }
  },
  "required": ["tasks"]
}
```

### Prioritizer Prompt

```
Goal: Score each task 0–100 using the weights provided in the scoring matrix. Return strict JSON matching the schema. Include a short human explanation.
Buckets: P0 >= 70, P1 50–69, P2 30–49, P3 < 30.
Only output JSON.
```

**JSON Schema**

```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["title", "priority_score", "priority_bucket", "explanation"],
        "properties": {
          "title": {"type": "string"},
          "priority_score": {"type": "number"},
          "priority_bucket": {"type": "string", "enum": ["P0","P1","P2","P3"]},
          "explanation": {"type": "string"}
        }
      }
    }
  },
  "required": ["results"]
}
```

### Summarizer Prompt

```
Goal: Write a daily digest for {project_code} in markdown with sections: Top Priorities, Projects at Risk, Key Meetings, Progress Summary. Keep bullets crisp; include dates when known. If there is no data for a section, omit the section.
Output: plain markdown.
```

---

## DB Migrations (Supabase/Postgres + pgvector)

> Create the minimal new tables while keeping compatibility with `schema.md`.

```sql
-- 1) Tasks (new)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id text null references projects(id) on delete set null,
  title text not null,
  description text null,
  due_date date null,
  status text not null default 'todo', -- todo|in_progress|done
  priority_score double precision null,
  priority_bucket text null,          -- P0|P1|P2|P3
  reason jsonb null,                  -- explanation blob from prioritizer
  source_item_id text null references items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_project_idx on tasks(project_id);
create index if not exists tasks_bucket_idx on tasks(priority_bucket);

-- 2) Digests (new per‑project daily)
create table if not exists daily_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id text null references projects(id) on delete set null,
  for_date date not null,
  summary_md text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists daily_digests_unique on daily_digests(user_id, project_id, for_date);

-- 3) Ensure embeddings table exists (vector(1536))
-- If using the existing Embedding model, ensure the extension
create extension if not exists vector;
```

---

## Endpoints & DTOs (NestJS)

### 1) `POST /ingest/manual`

**Body DTO**

```ts
export type IngestManualDto = {
  projectCode?: string;            // optional; can be inferred from text
  kind: 'note' | 'meeting' | 'action_items';
  title?: string;
  raw_text: string;                // full text blob
  occurred_at?: string;            // ISO datetime
  tags?: string[];
};
```

**Behavior**

* Persist an `items` row (`type = NOTE`), attach project if provided.
* Enqueue `IngestJob` with `itemId`.
* Respond `{ itemId }`.

### 2) `POST /tasks/rescore?project=AXIS`

* Re-run prioritization for all non-done tasks in scope.
* Respond `{ updated: number }`.

### 3) `GET /digest/today?project=AXIS`

* Returns latest digest markdown for project (or global if missing).

### 4) `GET /tasks?project=AXIS&bucket=P0,P1`

* Returns tasks sorted by `priority_score desc` with `reason`.

---

## Background Jobs (queue/cron)

### `IngestJob`

**Steps**

1. **Normalize**: trim, unify quotes, collapse whitespace, detect date mentions, compute `content_hash` (project+kind+text).
2. **Chunk**: 800–1200 tokens with \~200 overlap.
3. **Embed**: `text-embedding-3-small` (1536‑d). Store vectors in `embeddings`.
4. **Agent Graph**:

   * **Extractor** → upsert `tasks`.
   * **Prioritizer** → score & bucket, store `reason`.
   * **Summarizer** → write/update `daily_digests` for `today` (project + global).

### `DailyDigestCron` (06:00 local)

* For each active project: pull last 24–48h items + open P0/P1 tasks → run **Summarizer**.

---

## Retrieval (RAG) utilities

**Top‑K query (pgvector)**

```sql
select i.id, i.title, i.body
from embeddings e
join items i on i.id = e."itemId"
where i."projectId" = $1
order by e.vector <-> $2::vector
limit $3;
```

**Chunking defaults**

```ts
const CHUNK_SIZE_TOKENS = 1000;
const CHUNK_OVERLAP_TOKENS = 200;
```

---

## Scoring Matrix (editable JSON in repo)

*Save as `config/prioritization.json` and load at runtime.*

```json
{
  "weights": {
    "urgency": 0.40,
    "impact": 0.40,
    "risk_boost": 0.15,
    "effort_penalty": 0.05
  },
  "keywords": {
    "urgency": ["today","tomorrow","EOD","deadline","urgent"],
    "impact": ["prod","deployment","customer","security","payment","auth"],
    "risk": ["blocked","risk","slipping","dependency"],
    "effort_low": ["small","quick","typo","copy"],
    "effort_high": ["spike","refactor","migration"]
  },
  "bucket_thresholds": {"P0": 70, "P1": 50, "P2": 30}
}
```

---

## Implementation Pseudocode

### Ingest pipeline (service)

```ts
async function runIngest(itemId: string) {
  const item = await db.items.find(itemId);
  const text = normalize(item.body ?? extractRaw(item.raw));
  const chunks = chunk(text);
  const vecs = await embed(chunks);
  await db.embeddings.insertMany(item.userId, item.id, vecs, chunks);

  // 1) Extract tasks
  const extractJson = await agent.extractor(chunks.join('\n\n'));
  await upsertTasks(item, extractJson.tasks);

  // 2) Prioritize
  const scored = await agent.prioritizer(getOpenTasks(item.projectId));
  await storeScores(scored);

  // 3) Summarize
  const md = await agent.summarizer(item.projectId);
  await upsertDailyDigest(item.userId, item.projectId, today(), md);
}
```

---

## Dashboard Wiring (queries)

* **Top Priorities** → `select * from tasks where status != 'done' and project_id = $p order by priority_score desc limit 10`.
* **Projects at Risk** → compute score from: overdue count, P0 count, recent `#risk` notes; store in `risk_scores` (existing).
* **Latest Digest** → `select summary_md from daily_digests where project_id = $p order by for_date desc limit 1`.
* **Today’s Meetings** (manual for now) → `items` where `type='NOTE'` and `kind='meeting'` in raw.

---

## Quick Add UI (MVP spec)

* **Form**: `{ kind (note|meeting|action_items), projectCode?, title?, raw_text, occurred_at?, tags[] }`.
* **Action**: POST `/ingest/manual` → toast → optimistic row in “Latest Ingest”.
* **Validation**: 2–10k chars; show token estimate.

---

## Admin Rescore (MVP)

* Button in settings → POST `/tasks/rescore?project={code}` → snackbar with `{updated}`.

---

## Acceptance Tests (happy paths)

1. **Ingest**: posting a meeting summary yields ≥1 task with default owner `me`.
2. **Prioritize**: tasks with due today and "blocked" land in P0 with explanation string.
3. **Summarize**: after ingest, `daily_digests` has a row for today with a Top Priorities section.
4. **Rescore**: changing `prioritization.json` thresholds changes buckets on next rescore.
5. **Dashboard**: Top Priorities lists tasks ordered by `priority_score desc`.

---

## Notes

* Default owner is **me** (single-user phase). We will re‑introduce owners when multi‑user lands.
* Store all agent outputs (prompt + raw JSON) with a `version` field for observability.
* Deduplicate by `(project_id, kind, content_hash)`.

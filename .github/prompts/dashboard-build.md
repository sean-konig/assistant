Awesome — here’s a Copilot-ready build plan you can paste straight into your coding agent. It’s broken into precise chunks with what to build, why, interfaces, acceptance criteria, and smoke tests. It assumes your current stack (NestJS API, Supabase/Postgres + pgvector, existing ingestion/indexer, SSE streaming).

⸻

Build Plan: Global “Dashboard Agent” (Daily Digest + Tasks)

0) Prereqs & guardrails stance

Goal: A single global/main chat agent that aggregates context across all projects (tasks, notes, meetings, risks) and returns a grounded, formatted daily digest and authoritative task list, with interactive action proposals.

Rules of engagement
	•	Use input guardrails to block/rewrite off-scope or vague asks before heavy work.
	•	Use output guardrails to enforce reply shape (sections + machine tail) and grounding.
	•	Retrieval is read-only. Creation happens via action tools → app APIs (no silent DB writes).

⸻

1) Create Input Guardrail (Global)

What to build (behavior only)
	•	An input guardrail definition for the global agent that receives { userPrompt } and optionally a time hint (e.g., “today”).
	•	Classify intent ∈ ["daily_digest","task_query","plan","status","general_q"].
	•	If the ask is clearly off scope (trivia/outside assistant domain) → tripwire=true with a friendly message.
	•	If ambiguous → rewritten prompt that adds clarity (e.g., “Generate my daily digest for today across all projects. Include meetings, top risks, and up to 7 priority tasks.”).

Return contract

{ tripwire: boolean, message: string, rewritten: string, intent: string }

Expected outcome
	•	Only clear, project-agnostic requests proceed. Costs are protected; dumb asks are gracefully stopped.

Acceptance
	•	Off-scope question → tripwire w/ suggestion.
	•	Vague ask → concise rewritten with “today/tomorrow/this week” normalization.
	•	Good ask → passes through unchanged.

⸻

2) Create Output Guardrail (Global)

What to build (behavior only)
	•	An output guardrail definition for the global agent that validates the final reply:
	•	Required sections in markdown:
## Today’s Overview / ## Top Priorities (Next Steps) / ## Meetings / ## Tasks / ## Projects at Risk (optional) / ## Quick actions
	•	Grounding: tasks/claims must come from retrieved context; otherwise mark uncertainty or ask for the missing input.
	•	Machine tail (fenced JSON or YAML) is present with:
	•	intent
	•	references: [{ itemId, title?, kind, confidence }]
	•	proposed_tasks: [{ title, status:"TODO", dueDate?, projectId?, note? }]
	•	followups: [string]
	•	If formatting is missing but content is valid → return a patched reply with the required sections and tail.
	•	If unsafe or ungrounded → tripwire=true and short reason.

Expected outcome
	•	Consistent, button-ready replies that never hallucinate tasks.

Acceptance
	•	Missing sections → patched reply adds them.
	•	Fabricated tasks → removed; reply now asks for clarification or cites source.
	•	Machine tail parses and maps to UI widgets.

⸻

3) Define Tools (Proposals → App executes)

What to build
	•	Register three agent tools with clear schemas (these are proposals, not direct mutations):
	1.	create_task({ title, status:"TODO", dueDate?, projectId?, note? })
	2.	add_note({ title?, body, projectId?, tags? })
	3.	set_reminder({ content, dueAt })
	•	The UI/backend maps accepted proposals → your existing endpoints (e.g., /ingest/manual with kind=TASK/NOTE, or your reminders service).

Expected outcome
	•	Replies contain actionable Quick actions + a machine tail with the same proposals, letting UI render buttons and call APIs.

Acceptance
	•	Asking “Add prepare slides for Mon” yields a natural reply and a create_task proposal with Monday’s ISO date.

⸻

4) Build a Global Retrieval Tool (read-only)

What to build
	•	A single tool callable by the agent:
fetch_global_context({ query?: string, date?: string, k?: number }) → { snippets[], refs[], tasks[], meetings[], risks[] }

Behavior
	•	Tasks (authoritative): top 100 tasks across user’s projects; include title,status,dueDate,projectId.
	•	Meetings (today): upcoming meetings from items or calendar table.
	•	Risks: latest per project (score, label, updatedAt).
	•	Notes/Docs: vector search over embeddings joined to items (filter by user; k default 8); drop rows with distance > cutoff (e.g., 0.6).
	•	Snippets/refs: for each retrieved note/doc, return { itemId, kind, title?, distance, snippet }.

Expected outcome
	•	The agent can self-serve a minimal knowledge pack for today’s digest and task answers.

Acceptance
	•	No off-user data leaks.
	•	Distances + item IDs returned for optional citation pills.
	•	Empty sets handled gracefully (e.g., “No meetings today.”).

⸻

5) Define the Global Agent (system behavior)

What to build
	•	A single agent (“Lumo – Global Copilot”) configured with:
	•	Input guardrail → from §1
	•	Output guardrail → from §2
	•	Tools → from §3 and §4
	•	System behaviors (concise bullets):
	•	Answer across all projects.
	•	Always ground tasks/claims in fetched context or say what’s missing.
	•	Always return the required markdown sections and a machine tail with actions.
	•	If time period is missing, assume today; otherwise respect date or “tomorrow/this week”.
	•	Suggest 3–7 next steps, verb-first, high-leverage first.
	•	Prefer DB tasks over prior assistant messages.

Expected outcome
	•	A single callable agent that, when asked “What’s my plan today?”, produces a complete, actionable digest.

Acceptance
	•	Example input: “What should I focus on today?” → returns Today’s Overview, meetings, top priorities, tasks, quick actions, machine tail with proposed_tasks.

⸻

6) Expose Endpoints

What to build
	1.	Global chat (stream)
	•	GET /agent/global/chat/stream?message=...
	•	Build messages: system + short recent chat + user(message) (use guardrails+tools automatically via agent run).
	•	Stream { token } SSE; optionally interleave { ref:[{ itemId, score }] } events when the retrieval tool fires.
	2.	Daily digest (non-chat)
	•	GET /agent/global/digest?date=YYYY-MM-DD
	•	Internally calls the global agent with a fixed rewritten prompt, e.g.,
“Generate my daily digest for {date}: meetings, top risks, 3–7 priorities, and my tasks list.”

Expected outcome
	•	Chat UI stays simple; dashboard widgets can fetch digest without chat.

Acceptance
	•	SSE stream unchanged for chat.
	•	Digest endpoint returns stable, parseable sections + tail.

⸻

7) Scheduler: Daily Digest @ 06:00

What to build
	•	A scheduled job (Cloud Run Job/cron) that:
	•	Calls /agent/global/digest?date=today.
	•	Stores the rendered digest to digests table (for the Dashboard “Latest Digest” card).
	•	Optionally sends email/Slack.

Expected outcome
	•	“Latest Digest” card is always populated by ~06:00.

Acceptance
	•	Running locally with a flag triggers today’s digest and saves it.
	•	Failure logs are clear and retriable.

⸻

8) UI Payload Contracts (what the API must guarantee)

Digest card expects
	•	title: string (e.g., “Daily Executive Digest — Sep 19, 2025”)
	•	sections: { overview: string[], priorities: string[], meetings: {time,title}[], tasks: {title,status,dueDate?,project}[], risks: {project,score,label}[] }
	•	actions: [ { kind: "create_task" | "add_note" | "set_reminder", args: {...} } ]
	•	references: [{ itemId, title?, kind, confidence }] (for optional citation pills)

Tasks widget expects
	•	tasks: [{ id?, title, status, dueDate?, project }] (authoritative from DB)

Acceptance
	•	The agent reply’s machine tail maps 1:1 to these shapes.
	•	UI can render without scraping the human text.

⸻

9) Observability & guardrail traces

What to build
	•	Log prefixes: [GLOBAL:INPUT], [GLOBAL:CTX], [GLOBAL:CHAT], [GLOBAL:OUTPUT], [GLOBAL:ACTIONS].
	•	Emit: snippet counts, distance thresholds, number of tasks surfaced, guardrail decisions (blocked/rewritten/patched).
	•	(Optional) Integrate Langfuse/OpenTelemetry later; keep structured logs now.

Expected outcome
	•	You can diagnose “why did the digest say this?” in <1 minute.

Acceptance
	•	One end-to-end request shows a coherent trace with costs and outcome.

⸻

10) Tests & smoke runs

What to build
	•	Unit: input guardrail (tripwire, rewrite), output guardrail (section patch), retrieval tool (filters by user, distance cutoff).
	•	Integration:
	•	Chat stream returns tokens + final tail; no hallucinated tasks when none exist.
	•	Digest endpoint returns required sections even with empty meetings.
	•	Smoke (manual):
	1.	Seed 2 projects, 5 tasks (some due today), 1 risk>threshold, 1 note mentioning “auth bug”.
	2.	Call /agent/global/digest?date=today.
	3.	Verify the digest lists today’s meetings (or “none”), highlights urgent tasks first, includes the risk project, proposes at least one useful action.

⸻

11) Rollout plan
	•	Phase A (today): Global agent w/ guardrails + retrieval tool; digest endpoint + stream chat; UI renders digest & tasks.
	•	Phase B: Emit { ref:[...] } SSE and show citation pills; add set_reminder.
	•	Phase C: Weekly digest + “next week preview”; master agent handoffs (optional).

⸻

12) Example prompts (drop-in)

System (Global Agent)

You are Lumo – Global Copilot. Aggregate context across all projects to help Sean plan the day. Always return:
	•	## Today’s Overview (1–3 bullets)
	•	## Top Priorities (Next Steps) (3–7 imperative bullets; high-leverage first)
	•	## Meetings (time, title)
	•	## Tasks (authoritative, grouped by due/overdue; no inventions)
	•	## Projects at Risk (if any)
	•	## Quick actions (buttons the UI can map to tools)
Then add a short machine tail with intent, references, proposed_tasks, followups.
If context is missing, say so and ask for one specific thing, then proceed with what’s available.

Input guardrail (Global)

You are the Global Input Guardrail. Given { userPrompt }, return { tripwire, message, rewritten, intent }.
Block unsafe/off-scope asks. If vague, rewrite succinctly (normalize to “today/tomorrow/this week”). Intent ∈ daily_digest | task_query | plan | status | general_q.

Output guardrail (Global)

You are the Global Output Guardrail. Validate the final reply for section completeness, grounding, and actionability. If minor issues, return a patched markdown with all required sections and a valid machine tail. If ungrounded/unsafe, tripwire with a short reason. Never invent tasks; prefer DB tasks; mark uncertainties plainly.

⸻

If you want, I can also generate a mini checklist of file paths (controllers/services/modules) matched to each step, but this prompt is already ready to paste into Copilot so it can scaffold the code with the right contracts and tests.
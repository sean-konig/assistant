Perfect—here’s a tight, Copilot-ready plan split into well-defined chunks. Each chunk tells Copilot what it is, why we’re doing it, what to build (no code), and how we’ll know it works. I’ve aligned this with your current schema/agent setup so it plugs in cleanly.

⸻

Refactor Plan — Guardrails + Rich Actions

1) Create Input Agent (Guardrail)

Description
A lightweight pre-processor that receives the raw user message + project metadata and decides whether to pass, rewrite for clarity, or block as out-of-scope/unsafe.

What to implement (no code, behavior only)
	•	Inputs: { projectId, projectSlug, userPrompt } and optional { lastNChatTurns }.
	•	Classify: intent ∈ [status, plan, task_query, meeting_prep, general_q].
	•	Scope check: if message is not about this project, return tripwire=true with a short suggestion to switch context.
	•	Clarity rewrite: if vague, produce a rewritten prompt that adds project name and implied parameters.
	•	Safety: block clearly unsafe asks.

Output contract

{ tripwire: boolean, message: string, rewritten: string, intent: string }

Expected outcome
Cleaner, project-scoped prompts reach the chat agent; irrelevant/unsafe input gets gracefully stopped early.

Acceptance checks
	•	Returns tripwire=true for off-project questions (e.g., personal budget in Axis project).
	•	Adds missing specifics in rewritten (e.g., “status on ingest/indexer for ”).
	•	Leaves good prompts untouched.

Notes
This runs before RAG. Keep it fast. We’ll pass intent forward to steer the output shape.
Grounds in our architecture docs and schema (ingestion→items, embeddings→RAG).

⸻

2) Create Output Agent (Guardrail)

Description
A post-processor that validates the main agent’s draft, ensures required sections are present, grounds claims in Context/DB, and adds actionable “Create task / Add note” suggestions.

What to implement
	•	Inputs: draftReply (markdown), Context snippets, dbTasks[], intent.
	•	Checks:
	•	Includes sections: ## Summary, ## Recommendations (Next Steps), ## Quick actions.
	•	Grounding: decisive claims must map to Context/DB; otherwise mark as uncertain or request the missing data.
	•	Task suggestions: if intent ∈ [plan, task_query, status], propose at least one task.
	•	May lightly patch missing sections or formatting.

Output contract

{ tripwire: boolean, message: string, patched_reply?: string }

Expected outcome
Consistent, rich answers with actionable follow-ups and zero hallucinated tasks.

Acceptance checks
	•	Missing sections → patched_reply adds them.
	•	Fabricated tasks → removed; reply asks for data or cites DB.
	•	Produces at least one sensible “create task” option when appropriate.

Notes
This runs after the chat agent and before the UI sees the text.

⸻

3) Create Action Tools (Task / Note creation)

Description
Declarative tool intentions (no direct DB calls here) that the UI can turn into one-click actions. The chat agent proposes actions; the UI executes via your existing APIs.

What to implement
	•	Tool names: create_task, add_note.
	•	Tool payloads (proposals only, not execution):
	•	create_task: { title, status:"TODO", dueDate?, projectId, note? }
	•	add_note: { title?, body, projectId, tags? }
	•	The Output Agent ensures proposals exist in a machine-readable tail.

Expected outcome
Replies come with zero-conf friction: user can click “Create task” and we call /ingest/manual to persist (kind=TASK/NOTE). Items then get indexed and feed RAG.

Acceptance checks
	•	When user asks “what next?”, the reply contains 1–3 create_task proposals tied to this project.
	•	When user dictates notes, the reply includes an add_note proposal.

⸻

4) Context Provider (RAG + DB truth)

Description
A single place that assembles retrieval context for the chat agent and the Output Agent.

What to implement
	•	Inputs: { projectId, query, k=6 }
	•	Steps:
	•	Embed query (1536-d) → pgvector similarity search over embeddings joined with items filtered by projectId.
	•	Return snippets and refs: [{ itemId, kind, title?, distance, snippet }].
	•	If user asks “tasks”, also fetch authoritative DB tasks list (top 50).
	•	Apply optional min distance cutoff (e.g., >0.6 → drop).
	•	Outputs: { snippets[], refs[], dbTasks[] }

Expected outcome
Every reply is grounded: the agent “sees” the right notes/tasks, and the UI can show citations.

Acceptance checks
	•	Off-project rows never appear.
	•	Distances present; citations are possible (itemId + score).
	•	Task answers prefer DB list over prior assistant text.

⸻

5) Orchestrator (Message flow)

Description
A minimal router that wires the three stages together in one pass for streaming.

What to implement
	•	Flow:
	1.	Input Agent → if tripwire, return the message to UI.
	2.	Context Provider → fetch {snippets, refs, dbTasks}.
	3.	Chat Agent → build message sequence: system guardrails + history + user (rewritten or original) + a lightweight context block (summarized).
	4.	Output Agent → validate/patch, add tools tail.
	5.	Emit SSE tokens and optional ref events to UI.
	•	Pass along intent to influence answer layout.

Expected outcome
Single pipeline, same endpoint. Answers are richer without modifying the UI contract.

Acceptance checks
	•	SSE still emits { token } stream and a terminal { done }.
	•	(Optional) occasionally emit { ref: [{itemId, score}] } for citation pills.

⸻

6) Reply Shape (Human + Machine tail)

Description
Standardize what the chat agent returns, so UI and automations can parse reliably.

What to implement
	•	Human sections (markdown):
## Summary / ## Recommendations (Next Steps) / ## Notes & Risks (optional) / ## Quick actions
	•	Machine tail (fenced code block, YAML or JSON):
	•	intent: answer|plan|status|task_query|meeting_prep
	•	references: [{ itemId, title?, kind, confidence }]
	•	proposed_tasks: [{ title, status:"TODO", dueDate?, projectId, note? }]
	•	followups: [string]

Expected outcome
UI can render next-step buttons and show citations without brittle parsing.

Acceptance checks
	•	Tail parses as valid YAML/JSON.
	•	Proposed tasks map 1:1 to visible Quick-action buttons.

⸻

7) Logging & Observability

Description
Give us traces across the pipeline for debugging & cost tracking.

What to implement
	•	Log prefixes: [INPUT], [CTX], [CHAT], [OUTPUT], [ACTIONS].
	•	Count: retrieved snippets, chunk count, dims (1536), distances.
	•	Guardrail decisions: why we blocked or rewrote.
	•	Store a compact audit (prompt hash, cost estimates) for later.
(Compatible with Langfuse/OpenTelemetry later.)

Expected outcome
We can explain every reply and quickly spot bad grounding or missing data.

Acceptance checks
	•	A single request’s journey is readable end-to-end in logs.
	•	Embedding dim mismatch or empty context are clearly surfaced.

⸻

8) Configuration & Contracts

Description
Tighten environment and schema assumptions so Copilot doesn’t drift.

What to implement
	•	Embed model: text-embedding-3-small 1536-d. Treat ⟂ dims as error.
	•	Ensure vector column uses vector(1536); rely on items.projectId for filtering (join), not on embeddings alone.
	•	Respect schema types (Item, Embedding, RiskScore) as defined.

Expected outcome
RAG queries stay correct; indexer and chat agree on dims and filters.

Acceptance checks
	•	Migration confirms vector(1536).
	•	RAG SQL filters by i.projectId in the join.

⸻

9) Rollout Plan

Description
Introduce with minimal risk, then layer on extras.

What to implement
	•	Phase A (today): Input Agent + Context Provider + Output Agent enforcing sections; action proposals in tail.
	•	Phase B: add { ref: [...] } SSE events and small UI pills for citations.
	•	Phase C: daily risk recompute + daily digest uses the same Context Provider.

Expected outcome
Incremental wins: better answers immediately; richer UI later without API thrash.

Acceptance checks
	•	No breaking changes to streaming endpoint or UI.
	•	Team can toggle guardrails on/off via env flag during bake-in.

⸻

Prompts (drop-in, ultra-concise)

Input Agent prompt

You are the Project Input Guardrail. Given {projectSlug, userPrompt}, return:
tripwire (true|false), message, rewritten (clarified prompt if useful), intent ∈ [status, plan, task_query, meeting_prep, general_q].
Block if unsafe or out-of-scope for this project. If vague, rewrite succinctly using the project’s name.

Output Agent prompt

You are the Project Output Guardrail. Validate the agent’s reply against: grounding, required sections (Summary, Recommendations (Next Steps), Quick actions), and action proposals. If minor issues, return a patched_reply with fixes. Otherwise set tripwire=true and a short reason. Do not fabricate tasks—use DB list or ask for a missing piece.

Chat Agent system prompt (core behavior)

You are Lumo — project copilot. Compose a rich, grounded answer using provided Context and recent chat.
Always include:
	1.	Summary (context-aware),
	2.	Recommendations (Next Steps) (3–7 imperative bullets),
	3.	Quick actions (buttons the UI can map to tools),
then a short machine tail: intent, references, proposed_tasks, followups.
If context is missing, say so and propose exactly one step to get it.

⸻

9) Update the UI so that buttons are displayed correctly from the responses

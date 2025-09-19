You’re right to want the guardrails attached to the agent rather than a separate pipeline. The Agents SDK was designed for exactly that: input/output guardrails configured on the agent via inputGuardrails/outputGuardrails, running alongside the agent’s execution path (and able to trip a “tripwire” if needed)  ￼.

Below is a clear, Copilot-ready plan that (a) keeps your working orchestrator stable, then (b) migrates to native agent guardrails, and (c) sets you up for a future master agent. I’ve broken it into the chunks you asked for: what to build, why, and the expected outcome.

⸻

Route forward (high level)
	•	Phase A (today): keep your orchestrator for stability. Wrap its retrieval + actions as Agent Tools so we don’t lose functionality.
	•	Phase B (next): move the checks into Agent Guardrails (input/output) on a project agent instance; call it directly from your endpoints. This aligns with the SDK design and simplifies long-term maintenance. Guardrails run “in parallel” to the agent and can block or patch output before the user sees it  ￼.
	•	Phase C (later): add a Master Agent that can hand off to project agents and summarize across projects (using agent handoffs and your existing retrieval tool)  ￼.

⸻

1) Create Input Agent (input guardrail on the Agent)

Description
An input guardrail that runs on the incoming user message for the project agent, checking scope/safety and optionally rewriting for clarity. If it trips, it stops the agent run (cheaply) before any expensive model calls. This is how the SDK intends input checks to be used  ￼.

What Copilot should build (no code here, just target behavior):
	•	Define an input guardrail for the project agent with this behavior:
	•	Scope: If not about this project, trigger tripwire with a short friendly message and suggested context switch.
	•	Clarity rewrite: If vague, return a compact rewritten prompt that includes the project slug/name and any implied parameters.
	•	Intent: Label one of status | plan | task_query | meeting_prep | general_q (forward this in agent context).
	•	Safety: Tripwire for unsafe/off-policy input.
	•	Ensure it returns the small struct { tripwire, message, rewritten, intent } (SDK wraps this in the guardrail result).

Expected outcome
	•	The agent itself enforces scope/safety/clarity before it does anything else; no separate pipeline step required.
	•	You reduce accidental spend and off-topic runs, exactly as the docs recommend  ￼.

Why this is better than the pipeline:
	•	Guardrails are first-class in the agent lifecycle and run at the right time by design (on the first agent in a chain)  ￼.
	•	Fewer moving parts; easier to reason about in tracing/debug.

⸻

2) Create Output Agent (output guardrail on the Agent)

Description
An output guardrail that runs on the final agent output, validating format and grounding. If the draft is missing required sections, it can patch the reply; if it contains unsafe or ungrounded claims, it can tripwire to block or request clarification  ￼.

What Copilot should build:
	•	Define an output guardrail on the same project agent with checks:
	•	Required sections: ## Summary, ## Recommendations (Next Steps), ## Quick actions.
	•	Grounding: all decisive claims must map to Context/DB; otherwise mark as uncertain or ask for a missing piece.
	•	Actions: ensure a machine-readable tail is present with intent, references, proposed_tasks, followups.
	•	Patch: If minor omissions, return a patched reply; else tripwire with a short reason.

Expected outcome
	•	Replies are consistently structured and safe before streaming completes; you stop hallucinated tasks or format drift in-agent (no extra service hop)  ￼.

⸻

3) Create Tools for task/note creation & retrieval

Description
Move your “pipeline pieces” into first-class Agent Tools so the project agent can pull context and propose actions natively. This preserves your existing logic but reduces bespoke orchestration.

What Copilot should build:
	•	Retrieval tool (read-only): fetch_context(projectId, query, k)
	•	Uses your embeddings + join to items filtered by projectId; returns { snippets[], refs[] (itemId, kind, title, distance) }.
	•	Respect the distance cutoff and never return off-project rows.
	•	This gives the agent self-serve RAG inside the agent loop.
	•	Task tool (proposal → your API executes): create_task({ title, status:'TODO', dueDate?, projectId, note? })
	•	Note tool (proposal → your API executes): add_note({ title?, body, projectId, tags? })

Expected outcome
	•	The project agent can retrieve and propose actions in one place; your UI still calls /ingest/manual (or similar) to actually persist.
	•	Cleaner separation: the agent proposes, the app decides and executes.

(The Agents SDK encourages configuring tools on the Agent, with guardrails running around the same Agent instance.)  ￼

⸻

4) Convert your project chat endpoint to call the Agent directly

Description
Replace the custom orchestrator call with a call to the project agent (with guardrails + tools configured). Use the SDK’s streamed run so input guardrails fire before heavy work, and output guardrails validate after the draft is produced  ￼.

What Copilot should build:
	•	The endpoint constructs the message sequence (system + history + user).
	•	Calls the Agent Runner (streamed); forwards token deltas to SSE.
	•	Emits optional ref events using the tool return (when available).

Expected outcome
	•	Identical streaming UX, simpler internal flow, better debuggability via SDK tracing.
	•	(Known quirk: older SDK builds had a bug where an input guardrail tripwire could fire after some stream deltas; watch your SDK version and tests)  ￼.

⸻

5) Keep your Indexer & Ingestion as-is (just tighten contracts)

Description
No changes to your storage path: keep items as truth; keep embeddings at 1536-d; keep backfill/refresh jobs. Just make sure the retrieval tool joins via items.projectId, not embeddings only, and enforces a reasonable distance cutoff.

Expected outcome
	•	RAG remains fast and accurate; agent tooling can rely on it.
	•	Easy to upgrade embeddings later without changing agent surface.

⸻

6) Prepare for a Master Agent (later)

Description
A top-level agent that summarizes across all projects to plan your day. It will use handoffs to project agents or call a global retrieval tool that merges per-project signals (tasks due/overdue, recent risks, meetings) and then compose a daily plan. The Agents SDK explicitly supports multi-agent patterns via handoffs and consistent guardrails per agent  ￼.

What Copilot should plan (not build yet):
	•	Master agent with its own input/output guardrails (time-boxed answers, “today” framing).
	•	Global retrieval tool (cross-project): top risks, due tasks (<72h), upcoming meetings, unread notes last 24–48h.
	•	Handoff to project agents when the user dives into a specific project’s details.

Expected outcome
	•	Your morning “one-pager” + quick actions (schedule, 3 most leveraged tasks, risk watchlist).
	•	Clean, scalable architecture: master agent orchestrates, project agents specialize.

⸻

Decision summary (what’s “best route forward”?)
	•	Yes, move to native agent guardrails. That’s what the SDK is designed for and will simplify your code long-term. Input checks run before work; output checks validate after work, all on the agent config itself  ￼.
	•	Turn your pipeline steps into Agent Tools (retrieval + action proposals). You keep your logic, but it becomes composable under the Agent.
	•	Keep ingestion/indexer as is, just ensure 1536-d and correct JOIN items filtering.
	•	Add a Master Agent later with handoffs for cross-project daily planning.

⸻

Quick acceptance checklist for Copilot
	1.	Project Agent has input and output guardrails configured; input can block/rewrite, output can patch/validate. (See SDK guides.)  ￼
	2.	Tools registered on the agent: fetch_context, create_task, add_note.
	3.	Endpoint calls Agent Runner (streamed); SSE unchanged; optional {ref:[…]} events supported.
	4.	Retrieval filters by items.projectId, returns {snippets, refs}; distance cutoff applied.
	5.	Replies always include required sections + machine tail; failing drafts are patched or blocked by output guardrail.
	6.	Logs/Tracing verify guardrail decisions and tool usage (SDK tracing supported)  ￼.
	7.	Parity tests prove answers match or exceed current orchestrator quality.

If you want, I can turn this into a docs/AGENT_REFACTOR.md that Copilot can follow step-by-step, plus the compact prompts to drop straight into the input and output guardrails.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { z } from "zod";
import {
  Agent,
  InputGuardrail,
  InputGuardrailTripwireTriggered,
  OutputGuardrail,
  OutputGuardrailTripwireTriggered,
  assistant as a,
  run,
  setDefaultOpenAIKey,
  system as s,
  tool,
  user,
} from "@openai/agents";
import { OpenAiService } from "../../llm/openai.service";
import { buildGlobalAgentInstructions } from "../instructions";
import { GlobalContextService, GlobalContextResult, GlobalContextQuery } from "./global-context.service";

const STREAM_CHUNK_SIZE = 120;

const GLOBAL_INPUT_GUARDRAIL_PROMPT = `You are the Global Input Guardrail. Inspect the incoming request and respond with JSON matching {
  "tripwire": boolean,
  "message": string,
  "rewritten": string,
  "intent": "daily_digest"|"task_query"|"plan"|"status"|"general_q"
}.
Block trivia, unsafe, or clearly out-of-scope asks (tripwire=true).
If the ask is vague, rewrite it to clarify scope (normalize time hints to today/tomorrow/this week).
If the ask is valid, pass it through unchanged. Keep responses under 80 tokens.`;

const GLOBAL_OUTPUT_GUARDRAIL_PROMPT = `You are the Global Output Guardrail. Given the draft reply plus context, respond with JSON matching {
  "tripwire": boolean,
  "message": string,
  "patched": string
}.
Ensure required markdown sections exist (## Today’s Overview, ## Top Priorities (Next Steps), ## Meetings, ## Tasks, optional ## Projects at Risk, ## Quick actions).
Validate grounding using provided context; if unsupported, tripwire with reason.
Append or repair a fenced JSON block with keys intent, references, proposed_tasks, followups, quick_actions.
If issues are minor, patch the reply; otherwise tripwire.`;

export type GlobalGuardrailIntent = 
  | "daily_digest"
  | "task_query"
  | "plan"
  | "status"
  | "general_q";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GlobalInputDecision {
  tripwire: boolean;
  message: string;
  rewritten?: string;
  intent: GlobalGuardrailIntent;
}

export interface GlobalOutputDecision {
  tripwire: boolean;
  message?: string;
  patched?: string;
}

export interface ProposedTask {
  title: string;
  status: "TODO";
  dueDate?: string | null;
  projectId?: string | null;
  note?: string | null;
}

export interface ProposedNote {
  body: string;
  projectId?: string | null;
  title?: string | null;
  tags?: string[];
}

export interface ProposedReminder {
  content: string;
  dueAt: string;
}

export interface ProposedAction {
  kind: "create_task" | "add_note" | "set_reminder";
  args: any;
}

interface RetrievalCallRecord {
  params: GlobalContextQuery;
  result: GlobalContextResult;
}

interface GlobalAgentRuntimeContext {
  userId: string;
  latestPrompt: string;
  guardrails: {
    input?: GlobalInputDecision;
    output?: GlobalOutputDecision;
  };
  retrieval: { calls: RetrievalCallRecord[] };
  proposals: {
    tasks: ProposedTask[];
    notes: ProposedNote[];
    reminders: ProposedReminder[];
  };
  history: ChatTurn[];
}

export interface GlobalDigestPayload {
  date: string;
  markdown: string;
  intent: GlobalGuardrailIntent;
  sections: {
    overview: string[];
    priorities: string[];
    meetings: Array<{ id?: string; title: string | null; time: string | null; projectId?: string | null }>;
    tasks: Array<{ id?: string; title: string; status: string; dueDate: string | null; project?: string | null; projectId?: string | null }>;
    risks: Array<{ projectId: string; project?: string | null; score: number; label?: string | null }>;
  };
  actions: ProposedAction[];
  references: Array<{ itemId: string; confidence?: number; projectId?: string | null }>;
  followups: string[];
}

export interface GlobalDigestResult {
  payload: GlobalDigestPayload;
  conversation: GlobalConversationResult;
  tail?: Record<string, unknown> | null;
}

export interface GlobalConversationResult {
  reply: string;
  intent: GlobalGuardrailIntent;
  references: Array<{ itemId: string; confidence?: number; projectId?: string | null }>;
  proposedTasks: ProposedTask[];
  proposedNotes: ProposedNote[];
  proposedReminders: ProposedReminder[];
  actions: ProposedAction[];
  guardrails: {
    input: GlobalInputDecision;
    output?: GlobalOutputDecision;
  };
  retrieval?: GlobalContextResult;
}

@Injectable()
export class GlobalAgentService {
  private readonly logger = new Logger(GlobalAgentService.name);

  constructor(
    @Inject(OpenAiService) private readonly llm: OpenAiService,
    @Inject(GlobalContextService) private readonly contextService: GlobalContextService
  ) {
    if (process.env.OPENAI_API_KEY) {
      try {
        setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
      } catch (error) {
        this.logger.error("Failed to set OpenAI key for global agent", error as Error);
      }
    }
  }

  async runConversation(
    userId: string,
    message: string,
    opts?: { history?: ChatTurn[]; timeHint?: string }
  ): Promise<GlobalConversationResult> {
    const history = opts?.history ?? [];
    const inputDecision = await this.evaluateInputGuardrail(userId, message, history, opts?.timeHint);
    if (inputDecision.tripwire) {
      this.logger.warn(`[GLOBAL:INPUT] blocked: ${inputDecision.message}`);
      return {
        reply: inputDecision.message,
        intent: inputDecision.intent,
        references: [],
        proposedTasks: [],
        proposedNotes: [],
        proposedReminders: [],
        actions: [],
        guardrails: { input: inputDecision },
        retrieval: undefined,
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      const warning = "Global agent is unavailable (missing API key).";
      this.logger.warn(`[GLOBAL:CHAT] ${warning}`);
      return {
        reply: warning,
        intent: inputDecision.intent,
        references: [],
        proposedTasks: [],
        proposedNotes: [],
        proposedReminders: [],
        actions: [],
        guardrails: { input: inputDecision },
        retrieval: undefined,
      };
    }

    const runtime = this.buildRuntimeContext(userId, history, inputDecision, message);
    const agent = this.createAgent(runtime, opts?.timeHint);
    const sequence = this.buildMessageSequence(history, inputDecision.rewritten ?? message, inputDecision.intent);

    let rawText = "";
    try {
      const streamed = await run(agent, sequence, { context: runtime, stream: true });
      const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });
      for await (const delta of textStream) {
        rawText += String(delta);
      }
      await streamed.completed;
    } catch (error) {
      if (error instanceof InputGuardrailTripwireTriggered) {
        const note = runtime.guardrails.input?.message ?? "Request blocked.";
        return {
          reply: note,
          intent: runtime.guardrails.input?.intent ?? inputDecision.intent,
          references: [],
          proposedTasks: [],
          proposedNotes: [],
          proposedReminders: [],
          actions: [],
          guardrails: { input: runtime.guardrails.input ?? inputDecision },
          retrieval: runtime.retrieval.calls.at(-1)?.result,
        };
      }
      if (error instanceof OutputGuardrailTripwireTriggered) {
        const note =
          runtime.guardrails.output?.message ||
          runtime.guardrails.input?.message ||
          "Reply blocked by guardrail.";
        return {
          reply: note,
          intent: runtime.guardrails.input?.intent ?? inputDecision.intent,
          references: this.aggregateReferences(runtime),
          proposedTasks: runtime.proposals.tasks,
          proposedNotes: runtime.proposals.notes,
          proposedReminders: runtime.proposals.reminders,
          actions: this.aggregateActions(runtime),
          guardrails: {
            input: runtime.guardrails.input ?? inputDecision,
            output: runtime.guardrails.output,
          },
          retrieval: runtime.retrieval.calls.at(-1)?.result,
        };
      }
      if (error instanceof Error) {
        this.logger.error("[GLOBAL:CHAT] run failed", error);
      }
      throw error;
    }

    const finalText = runtime.guardrails.output?.patched ?? rawText;

    this.logger.log(`[GLOBAL:ACTIONS] tasks=${runtime.proposals.tasks.length} notes=${runtime.proposals.notes.length} reminders=${runtime.proposals.reminders.length}`);

    return {
      reply: finalText,
      intent: runtime.guardrails.input?.intent ?? inputDecision.intent,
      references: this.aggregateReferences(runtime),
      proposedTasks: runtime.proposals.tasks,
      proposedNotes: runtime.proposals.notes,
      proposedReminders: runtime.proposals.reminders,
      actions: this.aggregateActions(runtime),
      guardrails: {
        input: runtime.guardrails.input ?? inputDecision,
        output: runtime.guardrails.output,
      },
      retrieval: runtime.retrieval.calls.at(-1)?.result,
    };
  }

  async *streamConversation(
    userId: string,
    message: string,
    opts?: { history?: ChatTurn[]; timeHint?: string }
  ): AsyncGenerator<string, GlobalConversationResult, unknown> {
    const result = await this.runConversation(userId, message, opts);
    for (const chunk of this.chunkForStream(result.reply)) {
      yield chunk;
    }
    return result;
  }

  private async evaluateInputGuardrail(
    userId: string,
    message: string,
    history: ChatTurn[],
    timeHint?: string
  ): Promise<GlobalInputDecision> {
    if (!this.llm.isEnabled()) {
      this.logger.warn("[GLOBAL:INPUT] guardrail bypassed (LLM disabled)");
      return {
        tripwire: false,
        message: "Guardrail disabled; continuing.",
        rewritten: message,
        intent: this.deriveFallbackIntent(message),
      };
    }

    const payload = {
      userId,
      userPrompt: message,
      timeHint: timeHint ?? null,
      history: history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
    };

    try {
      const raw = await this.llm.chatMarkdown(GLOBAL_INPUT_GUARDRAIL_PROMPT, JSON.stringify(payload, null, 2));
      const parsed = JSON.parse(raw ?? "{}") as Partial<GlobalInputDecision>;
      const intent = this.normaliseIntent(parsed.intent);
      const rewritten = typeof parsed.rewritten === "string" && parsed.rewritten.trim().length > 0
        ? parsed.rewritten.trim()
        : message;
      const text = typeof parsed.message === "string" && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : "OK";
      this.logger.log(`[GLOBAL:INPUT] tripwire=${Boolean(parsed.tripwire)} intent=${intent}`);
      return {
        tripwire: Boolean(parsed.tripwire),
        message: text,
        rewritten,
        intent,
      };
    } catch (error) {
      this.logger.error("[GLOBAL:INPUT] guardrail error", error as Error);
      return {
        tripwire: false,
        message: "Guardrail error; continuing.",
        rewritten: message,
        intent: this.deriveFallbackIntent(message),
      };
    }
  }

  private buildRuntimeContext(
    userId: string,
    history: ChatTurn[],
    input: GlobalInputDecision,
    latestPrompt: string
  ): GlobalAgentRuntimeContext {
    return {
      userId,
      latestPrompt,
      guardrails: { input },
      retrieval: { calls: [] },
      proposals: { tasks: [], notes: [], reminders: [] },
      history,
    };
  }

  private getRuntimeContext(runContext: any): GlobalAgentRuntimeContext {
    if (!runContext || typeof runContext !== "object" || !("context" in runContext)) {
      throw new Error("Agent tool called without context");
    }
    return (runContext as { context: GlobalAgentRuntimeContext }).context;
  }

  private createAgent(runtime: GlobalAgentRuntimeContext, timeHint?: string) {
    const fetchContextTool = tool({
      name: "fetch_global_context",
      description: "Retrieve cross-project tasks, meetings, risks, and relevant notes for the user.",
      parameters: z
        .object({
          query: z.string().min(3).max(2000).nullable().optional(),
          date: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .nullable()
            .optional(),
          k: z.number().int().min(1).max(20).nullable().optional(),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const context = this.getRuntimeContext(ctx);
        const query: GlobalContextQuery = {
          query: input.query ?? context.latestPrompt,
          date: input.date ?? undefined,
          k: input.k ?? undefined,
          intent: context.guardrails.input?.intent,
        };
        const result = await this.contextService.fetch(context.userId, query);
        this.logger.log(`[GLOBAL:CTX] tool query=${(query.query ?? '').slice(0, 60)} tasks=${result.tasks.length} meetings=${result.meetings.length} risks=${result.risks.length}`);
        context.retrieval.calls.push({ params: query, result });
        return JSON.stringify(result);
      },
    });

    const createTaskTool = tool({
      name: "create_task",
      description: "Propose a new TODO task. The app will confirm before creation.",
      parameters: z
        .object({
          title: z.string().min(3).max(200),
          status: z.literal("TODO"),
          dueDate: z.string().min(4).max(64).optional().nullable(),
          projectId: z.string().min(6).max(30).optional().nullable(),
          note: z.string().max(500).optional().nullable(),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const context = this.getRuntimeContext(ctx);
        const proposal: ProposedTask = {
          title: input.title.trim(),
          status: "TODO",
          dueDate: input.dueDate?.trim() || null,
          projectId: input.projectId?.trim() || null,
          note: input.note?.trim() || null,
        };
        context.proposals.tasks.push(proposal);
        return JSON.stringify({ proposed: proposal });
      },
    });

    const addNoteTool = tool({
      name: "add_note",
      description: "Propose adding a note captured from this conversation.",
      parameters: z
        .object({
          body: z.string().min(10).max(4000),
          title: z.string().max(120).optional().nullable(),
          projectId: z.string().min(6).max(30).optional().nullable(),
          tags: z.array(z.string().min(1).max(32)).max(10).optional().nullable(),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const context = this.getRuntimeContext(ctx);
        const proposal: ProposedNote = {
          body: input.body.trim(),
          title: input.title?.trim() || null,
          projectId: input.projectId?.trim() || null,
          tags: input.tags ?? undefined,
        };
        context.proposals.notes.push(proposal);
        return JSON.stringify({ proposed: proposal });
      },
    });

    const setReminderTool = tool({
      name: "set_reminder",
      description: "Propose scheduling a reminder for the user.",
      parameters: z
        .object({
          content: z.string().min(3).max(240),
          dueAt: z.string().min(4).max(64),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const context = this.getRuntimeContext(ctx);
        const proposal: ProposedReminder = {
          content: input.content.trim(),
          dueAt: input.dueAt.trim(),
        };
        context.proposals.reminders.push(proposal);
        return JSON.stringify({ proposed: proposal });
      },
    });

    const inputGuardrail: InputGuardrail = {
      name: "global-input",
      execute: async ({ context }) => {
        const runtimeContext = (context.context ?? {}) as GlobalAgentRuntimeContext;
        const outcome = runtimeContext.guardrails.input;
        if (!outcome) {
          return { tripwireTriggered: false, outputInfo: { reason: "missing-input" } };
        }
        return { tripwireTriggered: outcome.tripwire, outputInfo: outcome };
      },
    };

    const outputGuardrail: OutputGuardrail = {
      name: "global-output",
      execute: async ({ agentOutput, context }) => {
        const runtimeContext = (context.context ?? {}) as GlobalAgentRuntimeContext;
        const draft = typeof agentOutput === "string" ? agentOutput : String(agentOutput ?? "");
        const payload = {
          draft,
          intent: runtimeContext.guardrails.input?.intent ?? "general_q",
          retrieval: runtimeContext.retrieval.calls,
          proposals: runtimeContext.proposals,
        };

        if (!this.llm.isEnabled()) {
          runtimeContext.guardrails.output = { tripwire: false, message: "Guardrail disabled", patched: draft };
          return { tripwireTriggered: false, outputInfo: runtimeContext.guardrails.output };
        }

        try {
          const raw = await this.llm.chatMarkdown(
            GLOBAL_OUTPUT_GUARDRAIL_PROMPT,
            JSON.stringify(payload, null, 2)
          );
          const parsed = JSON.parse(raw ?? "{}") as { tripwire?: boolean; message?: string; patched?: string };
          const decision: GlobalOutputDecision = {
            tripwire: Boolean(parsed.tripwire),
            message: typeof parsed.message === "string" ? parsed.message.trim() : undefined,
            patched: typeof parsed.patched === "string" && parsed.patched.trim().length > 0
              ? parsed.patched.trim()
              : draft,
          };
          runtimeContext.guardrails.output = decision;
          this.logger.log(
            `[GLOBAL:OUTPUT] tripwire=${decision.tripwire} patched=${decision.patched ? decision.patched.length : 0}`
          );
          return { tripwireTriggered: decision.tripwire, outputInfo: decision };
        } catch (error) {
          this.logger.error("[GLOBAL:OUTPUT] guardrail error", error as Error);
          const decision: GlobalOutputDecision = { tripwire: false, message: "Guardrail error", patched: draft };
          runtimeContext.guardrails.output = decision;
          return { tripwireTriggered: false, outputInfo: decision };
        }
      },
    };

    return new Agent({
      name: "global",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      instructions: () =>
        buildGlobalAgentInstructions({
          intent: runtime.guardrails.input?.intent,
          dateHint: runtime.guardrails.input?.rewritten?.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? undefined,
        }),
      tools: [fetchContextTool, createTaskTool, addNoteTool, setReminderTool],
      inputGuardrails: [inputGuardrail],
      outputGuardrails: [outputGuardrail],
    });
  }

  private buildMessageSequence(history: ChatTurn[], message: string, intent: GlobalGuardrailIntent) {
    const seq: any[] = [];
    const header = [
      `Intent: ${intent}`,
      "Call fetch_global_context before answering if facts are missing.",
      "Never invent tasks or meetings; rely on tool outputs.",
      "Return required sections and JSON tail.",
    ].join("\n");
    seq.push(s(header));
    for (const turn of history.slice(-6)) {
      seq.push(turn.role === "user" ? user(turn.content) : a(turn.content));
    }
    seq.push(user(message));
    return seq;
  }

  private chunkForStream(text: string): string[] {
    if (!text) return [];
    const chunks: string[] = [];
    let idx = 0;
    while (idx < text.length) {
      chunks.push(text.slice(idx, idx + STREAM_CHUNK_SIZE));
      idx += STREAM_CHUNK_SIZE;
    }
    return chunks.length > 0 ? chunks : [text];
  }

  private aggregateReferences(context: GlobalAgentRuntimeContext) {
    const map = new Map<string, { itemId: string; confidence?: number; projectId?: string | null }>();
    for (const call of context.retrieval.calls) {
      for (const ref of call.result.references) {
        if (!map.has(ref.itemId)) {
          map.set(ref.itemId, ref);
        }
      }
    }
    return Array.from(map.values());
  }

  private aggregateActions(context: GlobalAgentRuntimeContext): ProposedAction[] {
    const actions: ProposedAction[] = [];
    for (const task of context.proposals.tasks) {
      actions.push({ kind: "create_task", args: task });
    }
    for (const note of context.proposals.notes) {
      actions.push({ kind: "add_note", args: note });
    }
    for (const reminder of context.proposals.reminders) {
      actions.push({ kind: "set_reminder", args: reminder });
    }
    return actions;
  }

  async generateDailyDigest(userId: string, dateInput: string): Promise<GlobalDigestResult> {
    const date = this.normaliseDate(dateInput);
    const prompt = `Generate my daily digest for ${date}: meetings, top risks, 3-7 priorities, and my tasks list.`;
    const result = await this.runConversation(userId, prompt, { history: [], timeHint: date });
    const tail = this.extractMachineTail(result.reply);
    const retrieval = result.retrieval ?? (await this.contextService.fetch(userId, { date }));

    const overview = this.extractSectionBullets(result.reply, "Today's Overview");
    const priorities = this.extractSectionBullets(result.reply, "Top Priorities (Next Steps)");

    const meetings = (retrieval?.meetings ?? [])
      .slice(0, 12)
      .map((meeting) => ({
        id: meeting.id,
        title: meeting.title ?? null,
        time: meeting.startsAt ?? null,
        projectId: meeting.projectId ?? null,
      }));

    const tasks = (retrieval?.tasks ?? [])
      .slice(0, 20)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        project: task.projectSlug ?? null,
        projectId: task.projectId ?? null,
      }));

    const risks = (retrieval?.risks ?? []).map((risk) => ({
      projectId: risk.projectId,
      project: risk.projectSlug ?? null,
      score: risk.score,
      label: risk.label ?? null,
    }));

    const followups = Array.isArray((tail as any)?.followups)
      ? ((tail as any).followups as unknown[])
          .filter((item) => typeof item === "string")
          .map((item) => (item as string).trim())
      : [];

    const payload: GlobalDigestPayload = {
      date,
      markdown: result.reply,
      intent: result.intent,
      sections: {
        overview,
        priorities,
        meetings,
        tasks,
        risks,
      },
      actions: result.actions,
      references: result.references,
      followups,
    };

    this.logger.log(`[GLOBAL:DIGEST] generated payload for ${date}`);

    return { payload, conversation: result, tail: (tail as Record<string, unknown> | null) ?? null };
  }

  private extractSectionBullets(reply: string, heading: string): string[] {
    const lines = reply.split(/\r?\n/);
    const normalise = (value: string) => value.toLowerCase().replace(/’/g, "'");
    const target = normalise(`## ${heading}`);
    const bullets: string[] = [];
    let collecting = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        const normalised = normalise(trimmed);
        if (normalised === target) {
          collecting = true;
          continue;
        }
        if (collecting) break;
      }
      if (!collecting) continue;
      if (!trimmed) continue;
      if (trimmed.startsWith("- ")) bullets.push(trimmed.slice(2).trim());
      else if (trimmed.startsWith("• ")) bullets.push(trimmed.slice(2).trim());
    }

    return bullets;
  }

  private extractMachineTail(reply: string): Record<string, unknown> | null {
    const match = reply.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (!match) return null;
    const captured = match[1];
    if (typeof captured !== 'string' || !captured.trim()) return null;
    const body = captured.trim();
    const attempt = (input: string) => {
      try {
        return JSON.parse(input);
      } catch {
        return null;
      }
    };

    const parsed = attempt(body);
    if (parsed) return parsed;
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return attempt(body.slice(start, end + 1));
    }
    return null;
  }

  private normaliseDate(input?: string): string {
    const date = input ? new Date(input) : new Date();
    if (Number.isNaN(date.getTime())) {
      const now = new Date();
      return now.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  private deriveFallbackIntent(message: string): GlobalGuardrailIntent {
    const lower = message.toLowerCase();
    if (/(digest|summary|overview)/.test(lower)) return "daily_digest";
    if (/(task|todo|action)/.test(lower)) return "task_query";
    if (/(plan|roadmap|strategy)/.test(lower)) return "plan";
    if (/(status|progress|update)/.test(lower)) return "status";
    return "general_q";
  }

  private normaliseIntent(intent: unknown): GlobalGuardrailIntent {
    const allowed: GlobalGuardrailIntent[] = [
      "daily_digest",
      "task_query",
      "plan",
      "status",
      "general_q",
    ];
    const text = typeof intent === "string" ? intent.toLowerCase().trim() : "";
    return allowed.includes(text as GlobalGuardrailIntent) ? (text as GlobalGuardrailIntent) : "general_q";
  }
}

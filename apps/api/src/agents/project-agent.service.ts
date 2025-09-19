import { Injectable, Inject, Logger } from "@nestjs/common";
import { z } from "zod";
import {
  Agent,
  InputGuardrail,
  OutputGuardrail,
  assistant as a,
  InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
  run,
  setDefaultOpenAIKey,
  system as s,
  tool,
  user,
} from "@openai/agents";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAiService } from "../llm/openai.service";
import { EmbeddingsService } from "../embeddings/embeddings.service";
import { buildProjectAgentInstructions } from "./instructions";

type ProjectLite = { id: string; slug: string; description?: string | null; userId?: string };
type GuardrailIntent = "status" | "plan" | "task_query" | "meeting_prep" | "general_q";
type ChatTurn = { role: "user" | "assistant"; content: string };

type InputGuardrailDecision = {
  tripwire: boolean;
  message: string;
  rewritten?: string;
  intent: GuardrailIntent;
};

type OutputGuardrailDecision = {
  tripwire: boolean;
  message?: string;
  patched?: string;
};

type RetrievalReference = {
  itemId: string;
  kind?: string | null;
  title?: string | null;
  distance: number;
};

type RetrievalCall = {
  query: string;
  snippets: string[];
  refs: RetrievalReference[];
};

type ProposedTask = {
  title: string;
  status: "TODO";
  dueDate?: string | null;
  projectId: string;
  note?: string | null;
};

type ProposedNote = {
  body: string;
  projectId: string;
  title?: string | null;
  tags?: string[];
};

type ProjectAgentRuntimeContext = {
  project: ProjectLite;
  userId: string | null;
  guardrails: {
    input?: InputGuardrailDecision;
    output?: OutputGuardrailDecision;
  };
  retrieval: {
    calls: RetrievalCall[];
  };
  proposals: {
    tasks: ProposedTask[];
    notes: ProposedNote[];
  };
  history: ChatTurn[];
};

type ConversationResult = {
  reply: string;
  intent: GuardrailIntent;
  references: RetrievalReference[];
  proposedTasks: ProposedTask[];
  proposedNotes: ProposedNote[];
  guardrails: {
    input: InputGuardrailDecision;
    output?: OutputGuardrailDecision;
  };
};

const INPUT_GUARDRAIL_PROMPT = `You are the input guardrail for the project agent. Given the project metadata and the latest user message, return JSON { tripwire: boolean, message?: string, rewritten?: string, intent?: "status"|"plan"|"task_query"|"meeting_prep"|"general_q" }.

1. Tripwire if the request is unsafe, off-policy, or about another project; message should politely redirect.
2. If tripwire is false and the message is vague, set rewritten to a concise prompt that names the project and clarifies implied details; otherwise leave rewritten undefined.
3. Always set intent for on-topic requests (pick the single best label).
4. Keep responses under 60 tokens; never call tools or models.
`;

const OUTPUT_GUARDRAIL_PROMPT = `You are the output guardrail for the project agent. Inspect the draft reply plus supporting context and either return { patched: string } or { tripwire: true, message: string }.

1. Require sections: "## Summary", "## Recommendations (Next Steps)", "## Quick actions". Add missing sections when patching.
2. Ensure all decisive claims are grounded in provided context; flag uncertain statements or tripwire if unsupported.
3. Append a machine-readable tail with keys intent, references, proposed_tasks, followups. Preserve existing JSON when valid; otherwise repair it.
4. Tripwire if safety policy is violated or grounding fails; keep messages short and actionable.
5. Do not introduce new facts beyond the context; stay under 120 tokens when patching.
`;

const STREAM_CHUNK_SIZE = 120;
const DEFAULT_TOP_K = 6;
const MAX_DISTANCE_THRESHOLD = 0.6;

@Injectable()
export class ProjectAgentService {
  private readonly logger = new Logger(ProjectAgentService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenAiService) private readonly llm: OpenAiService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService
  ) {
    if (process.env.OPENAI_API_KEY) {
      try {
        setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
      } catch (error) {
        this.logger.error("Failed to set default OpenAI key for agents", error as Error);
      }
    }
  }

  private deriveFallbackIntent(message: string): GuardrailIntent {
    const lower = message.toLowerCase();
    if (/(status|progress|update)/.test(lower)) return "status";
    if (/(plan|roadmap|next step)/.test(lower)) return "plan";
    if (/(task|todo|action)/.test(lower)) return "task_query";
    if (/(meeting|prep|agenda)/.test(lower)) return "meeting_prep";
    return "general_q";
  }

  private normaliseIntent(intent?: string | null): GuardrailIntent {
    if (!intent) return "general_q";
    const value = intent.toLowerCase().trim();
    if (["status", "plan", "task_query", "meeting_prep", "general_q"].includes(value)) {
      return value as GuardrailIntent;
    }
    return "general_q";
  }

  private async evaluateInputGuardrail(
    project: ProjectLite,
    message: string,
    history: ChatTurn[]
  ): Promise<InputGuardrailDecision> {
    if (!this.llm.isEnabled()) {
      return {
        tripwire: false,
        message: "Guardrail disabled; continuing",
        rewritten: message,
        intent: this.deriveFallbackIntent(message),
      };
    }

    const payload = {
      project: {
        id: project.id,
        slug: project.slug,
        description: project.description ?? null,
      },
      message,
      history: history.slice(-6).map((turn) => ({
        role: turn.role,
        content: turn.content.slice(0, 2000),
      })),
    };

    try {
      const raw = await this.llm.chatMarkdown(INPUT_GUARDRAIL_PROMPT, JSON.stringify(payload, null, 2));
      const parsed = JSON.parse(raw ?? "{}") as Partial<InputGuardrailDecision>;
      const tripwire = Boolean(parsed.tripwire);
      const intent = this.normaliseIntent(parsed.intent);
      const rewritten = typeof parsed.rewritten === "string" && parsed.rewritten.trim().length > 0
        ? parsed.rewritten.trim()
        : message;
      const messageText = typeof parsed.message === "string" && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : tripwire
          ? "Request blocked."
          : "OK";
      return { tripwire, message: messageText, rewritten, intent };
    } catch (error) {
      this.logger.error("Input guardrail failed; defaulting to pass-through", error as Error);
      return {
        tripwire: false,
        message: "Guardrail error; continuing",
        rewritten: message,
        intent: this.deriveFallbackIntent(message),
      };
    }
  }

  private buildRuntimeContext(project: ProjectLite, userId: string | null, history: ChatTurn[], input: InputGuardrailDecision): ProjectAgentRuntimeContext {
    return {
      project,
      userId,
      guardrails: {
        input,
      },
      retrieval: {
        calls: [],
      },
      proposals: {
        tasks: [],
        notes: [],
      },
      history,
    };
  }

  private getRuntimeContext(runContext: any): ProjectAgentRuntimeContext {
    if (!runContext || typeof runContext !== "object" || !("context" in runContext)) {
      throw new Error("Agent tool called without run context");
    }
    return (runContext as { context: unknown }).context as ProjectAgentRuntimeContext;
  }

  private createAgent(project: ProjectLite, runtimeContext: ProjectAgentRuntimeContext) {
    const fetchContextTool = tool({
      name: "fetch_context",
      description:
        "Retrieve project-scoped context snippets using embeddings for the active project.",
      parameters: z
        .object({
          query: z.string().min(3).max(2000),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const runContext = this.getRuntimeContext(ctx);
        const result = await this.retrieveContext(runContext.project.id, input.query, DEFAULT_TOP_K);
        runContext.retrieval.calls.push({ query: input.query, snippets: result.snippets, refs: result.refs });
        return JSON.stringify(result);
      },
    });

    const createTaskTool = tool({
      name: "create_task",
      description:
        "Propose a new TODO task for this project. The app will decide whether to persist it; never assume success.",
      parameters: z
        .object({
          title: z.string().min(3).max(200),
          status: z.literal("TODO"),
          dueDate: z
            .string()
            .max(64)
            .nullable()
            .optional(),
          note: z
            .string()
            .max(500)
            .nullable()
            .optional(),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const runContext = this.getRuntimeContext(ctx);
        const proposal: ProposedTask = {
          title: input.title.trim(),
          status: "TODO",
          dueDate: input.dueDate?.trim() || null,
          note: input.note?.trim() || null,
          projectId: runContext.project.id,
        };
        runContext.proposals.tasks.push(proposal);
        return JSON.stringify({ proposed: proposal });
      },
    });

    const addNoteTool = tool({
      name: "add_note",
      description:
        "Propose adding a project note (markdown body). The UI will review before saving. Include tags when helpful.",
      parameters: z
        .object({
          body: z.string().min(10).max(4000),
          title: z
            .string()
            .max(120)
            .nullable()
            .optional(),
          tags: z
            .array(z.string().min(1).max(32))
            .max(10)
            .nullable()
            .optional(),
        })
        .strict(),
      strict: true,
      execute: async (input, ctx) => {
        const runContext = this.getRuntimeContext(ctx);
        const proposal: ProposedNote = {
          body: input.body.trim(),
          title: input.title?.trim() || null,
          tags: input.tags ?? undefined,
          projectId: runContext.project.id,
        };
        runContext.proposals.notes.push(proposal);
        return JSON.stringify({ proposed: proposal });
      },
    });

    const inputGuardrail: InputGuardrail = {
      name: "project-input",
      execute: async ({ context }) => {
        const ctx = context.context as ProjectAgentRuntimeContext;
        const outcome = ctx.guardrails.input;
        if (!outcome) {
          return { tripwireTriggered: false, outputInfo: { reason: "missing-precheck" } };
        }
        return { tripwireTriggered: outcome.tripwire, outputInfo: outcome };
      },
    };

    const outputGuardrail: OutputGuardrail = {
      name: "project-output",
      execute: async ({ agentOutput, context }) => {
        const ctx = context.context as ProjectAgentRuntimeContext;
        const draft = typeof agentOutput === "string" ? agentOutput : String(agentOutput ?? "");
        const payload = {
          draft,
          intent: ctx.guardrails.input?.intent ?? "general_q",
          retrieval: ctx.retrieval.calls,
          proposals: ctx.proposals,
        };

        let decision: OutputGuardrailDecision = { tripwire: false };
        if (!this.llm.isEnabled()) {
          decision = {
            tripwire: false,
            message: "Guardrail disabled",
            patched: draft,
          };
        } else {
          try {
            const raw = await this.llm.chatMarkdown(OUTPUT_GUARDRAIL_PROMPT, JSON.stringify(payload, null, 2));
            const parsed = JSON.parse(raw ?? "{}") as { tripwire?: boolean; message?: string; patched?: string; patched_reply?: string };
            const tripwire = Boolean(parsed.tripwire);
            const patched = (parsed.patched ?? parsed.patched_reply) || undefined;
            decision = {
              tripwire,
              message: typeof parsed.message === "string" ? parsed.message.trim() : undefined,
              patched: patched?.trim(),
            };
          } catch (error) {
            this.logger.error("Output guardrail failed; returning draft", error as Error);
            decision = { tripwire: false, message: "Guardrail error", patched: draft };
          }
        }

        ctx.guardrails.output = decision;
        return { tripwireTriggered: decision.tripwire, outputInfo: decision };
      },
    };

    return new Agent({
      name: `project:${project.slug}`,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      instructions: () =>
        buildProjectAgentInstructions({
          projectName: project.slug,
          projectDescription: project.description,
          intent: runtimeContext.guardrails.input?.intent,
        }),
      tools: [fetchContextTool, createTaskTool, addNoteTool],
      inputGuardrails: [inputGuardrail],
      outputGuardrails: [outputGuardrail],
    });
  }

  private buildMessageSequence(history: ChatTurn[], userMessage: string, project: ProjectLite, intent: GuardrailIntent) {
    const seq: any[] = [];
    const metadataLines = [
      `Project slug: ${project.slug}`,
      `Primary intent: ${intent}`,
      `Remember: call fetch_context before answering if you lack facts. Use create_task/add_note only to propose actions.`,
      `All outputs must include the required markdown sections followed by YAML tail as specified.`,
    ];
    seq.push(s(metadataLines.join("\n")));

    for (const turn of history.slice(-9)) {
      seq.push(turn.role === "user" ? user(turn.content) : a(turn.content));
    }

    seq.push(user(userMessage));
    return seq;
  }

  private chunkForStream(text: string): string[] {
    if (!text) return [];
    const result: string[] = [];
    let idx = 0;
    while (idx < text.length) {
      result.push(text.slice(idx, idx + STREAM_CHUNK_SIZE));
      idx += STREAM_CHUNK_SIZE;
    }
    return result.length > 0 ? result : [text];
  }

  private aggregateReferences(context: ProjectAgentRuntimeContext): RetrievalReference[] {
    const map = new Map<string, RetrievalReference>();
    for (const call of context.retrieval.calls) {
      for (const ref of call.refs) {
        if (!map.has(ref.itemId)) {
          map.set(ref.itemId, ref);
        }
      }
    }
    return Array.from(map.values());
  }

  private extractSnippet(row: { body: string | null; raw: any; title: string | null }): string | null {
    const raw = row.raw ?? {};
    const markdown = typeof raw?.markdown === "string" ? raw.markdown : null;
    const text = typeof raw?.text === "string" ? raw.text : null;
    const lines = Array.isArray(raw?.lines) ? (raw.lines as string[]).join("\n") : null;
    const body = row.body ?? null;
    const snippet = markdown || text || lines || body || row.title;
    if (!snippet) return null;
    return String(snippet).slice(0, 800);
  }

  private async retrieveContext(projectId: string, query: string, k: number): Promise<{ snippets: string[]; refs: RetrievalReference[] }> {
    if (!query.trim()) {
      return { snippets: [], refs: [] };
    }

    let embedding: number[] | undefined;
    try {
      [embedding] = await this.embeddings.embed([query]);
    } catch (error) {
      this.logger.error("Failed to embed query for context retrieval", error as Error);
      return { snippets: [], refs: [] };
    }

    if (!embedding || embedding.length !== 1536) {
      this.logger.warn(`Query embedding missing or incorrect dimension: len=${embedding?.length ?? 0}`);
      return { snippets: [], refs: [] };
    }

    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; type: string; title: string | null; body: string | null; raw: any; distance: number }>
    >(
      `SELECT i.id, i.type, i.title, i.body, i.raw, e.vector <-> $2::vector as distance
       FROM embeddings e
       JOIN items i ON i.id = e."itemId"
       WHERE i."projectId" = $1
       ORDER BY e.vector <-> $2::vector
       LIMIT ${k}`,
      projectId,
      vectorLiteral
    );

    const snippets: string[] = [];
    const refs: RetrievalReference[] = [];

    for (const row of rows) {
      const distance = typeof row.distance === "number" ? row.distance : Number(row.distance);
      if (!Number.isFinite(distance) || distance > MAX_DISTANCE_THRESHOLD) {
        continue;
      }
      const snippet = this.extractSnippet(row);
      if (!snippet) continue;
      snippets.push(snippet);
      refs.push({
        itemId: row.id,
        kind: row.type,
        title: row.title,
        distance,
      });
    }

    return { snippets, refs };
  }

  async runConversation(
    project: ProjectLite,
    latestMessage: string,
    history: ChatTurn[] = [],
    opts?: { userId?: string }
  ): Promise<ConversationResult> {
    const inputDecision = await this.evaluateInputGuardrail(project, latestMessage, history);
    if (inputDecision.tripwire) {
      return {
        reply: inputDecision.message,
        intent: inputDecision.intent,
        references: [],
        proposedTasks: [],
        proposedNotes: [],
        guardrails: { input: inputDecision },
      };
    }

    const runtimeContext = this.buildRuntimeContext(project, opts?.userId ?? null, history, inputDecision);
    const agent = this.createAgent(project, runtimeContext);
    const effectiveMessage = inputDecision.rewritten ?? latestMessage;
    const sequence = this.buildMessageSequence(history, effectiveMessage, project, inputDecision.intent);

    let rawText = "";
    try {
      const streamed = await run(agent, sequence, { context: runtimeContext, stream: true });
      const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });
      for await (const delta of textStream) {
        rawText += String(delta);
      }
      await streamed.completed;
    } catch (error) {
      if (error instanceof InputGuardrailTripwireTriggered) {
        const message = runtimeContext.guardrails.input?.message ?? "Request blocked.";
        return {
          reply: message,
          intent: runtimeContext.guardrails.input?.intent ?? inputDecision.intent,
          references: [],
          proposedTasks: [],
          proposedNotes: [],
          guardrails: { input: runtimeContext.guardrails.input ?? inputDecision },
        };
      }
      if (error instanceof OutputGuardrailTripwireTriggered) {
        const reply =
          runtimeContext.guardrails.output?.message ||
          runtimeContext.guardrails.input?.message ||
          "Reply blocked by guardrail.";
        return {
          reply,
          intent: runtimeContext.guardrails.input?.intent ?? inputDecision.intent,
          references: this.aggregateReferences(runtimeContext),
          proposedTasks: runtimeContext.proposals.tasks,
          proposedNotes: runtimeContext.proposals.notes,
          guardrails: {
            input: runtimeContext.guardrails.input ?? inputDecision,
            output: runtimeContext.guardrails.output,
          },
        };
      }
      throw error;
    }

    const finalText = runtimeContext.guardrails.output?.patched || rawText;
    return {
      reply: finalText,
      intent: runtimeContext.guardrails.input?.intent ?? inputDecision.intent,
      references: this.aggregateReferences(runtimeContext),
      proposedTasks: runtimeContext.proposals.tasks,
      proposedNotes: runtimeContext.proposals.notes,
      guardrails: {
        input: runtimeContext.guardrails.input ?? inputDecision,
        output: runtimeContext.guardrails.output,
      },
    };
  }

  async *streamConversation(
    project: ProjectLite,
    latestMessage: string,
    history: ChatTurn[] = [],
    opts?: { userId?: string }
  ): AsyncGenerator<string, ConversationResult, unknown> {
    const result = await this.runConversation(project, latestMessage, history, opts);
    for (const chunk of this.chunkForStream(result.reply)) {
      yield chunk;
    }
    return result;
  }

  async replyOnce(project: ProjectLite, message: string) {
    const result = await this.runConversation(project, message, []);
    return result.reply;
  }

  async *replyStreamWithHistory(
    project: ProjectLite,
    latest: string,
    history: ChatTurn[]
  ): AsyncGenerator<string, ConversationResult, unknown> {
    return yield* this.streamConversation(project, latest, history);
  }

  async summarizeNote(itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Note not found");
    const markdown = (item as any).raw?.markdown || item.body || "";
    const result = await this.llm.summarizeNote(markdown);
    await this.prisma.item.update({
      where: { id: itemId },
      data: {
        raw: {
          ...(item as any).raw,
          summaryMarkdown: result.summaryMarkdown,
          tags: result.tags,
          noteType: result.noteType,
        },
      },
    });
    return result;
  }

  async computeRisk(projectId: string) {
    const items = await this.prisma.$queryRaw<
      any[]
    >`SELECT raw, "createdAt" FROM items WHERE "projectId" = ${projectId}`;
    const now = Date.now();
    const recentNotes = items.filter(
      (i) => i.raw?.kind === "NOTE" && (now - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 14
    );
    const riskTagCount = recentNotes.reduce(
      (acc, i) =>
        acc +
        (Array.isArray(i.raw?.tags) ? (i.raw.tags as string[]).filter((t) => /risk|block|issue/.test(t)).length : 0),
      0
    );
    const openTasks = items.filter((i) => i.raw?.kind === "TASK" && i.raw?.status !== "DONE").length;
    const score = Math.max(0, Math.min(100, openTasks * 10 + riskTagCount * 5));
    const factors = { openTasks, riskTagCount };
    const userId = (await this.prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } }))!
      .userId;
    const row = await this.prisma.riskScore.create({ data: { userId, projectId, score, factors } });
    return row;
  }
}

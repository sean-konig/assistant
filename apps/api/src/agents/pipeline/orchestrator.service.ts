import { Inject, Injectable, Logger } from "@nestjs/common";
import { OpenAiService } from "../../llm/openai.service";
import { InputGuardrailService } from "./input-guardrail.service";
import { OutputGuardrailService } from "./output-guardrail.service";
import { ContextProviderService } from "./context-provider.service";
import {
  ConversationParams,
  OrchestratorStreamOptions,
  GuardrailIntent,
  RetrievalBundle,
} from "./types";
import { CHAT_AGENT_SYSTEM_PROMPT } from "./prompts";

const STREAM_CHUNK_SIZE = 120;

@Injectable()
export class ProjectConversationOrchestrator {
  private readonly logger = new Logger(ProjectConversationOrchestrator.name);

  constructor(
    @Inject(OpenAiService) private readonly llm: OpenAiService,
    @Inject(InputGuardrailService) private readonly inputGuardrail: InputGuardrailService,
    @Inject(OutputGuardrailService) private readonly outputGuardrail: OutputGuardrailService,
    @Inject(ContextProviderService) private readonly contextProvider: ContextProviderService
  ) {}

  async runConversation(params: ConversationParams, stream?: OrchestratorStreamOptions): Promise<{
    reply: string;
    intent: GuardrailIntent;
    retrieval: RetrievalBundle;
  }> {
    const input = await this.inputGuardrail.evaluate({
      projectId: params.project.id,
      projectSlug: params.project.slug,
      userPrompt: params.latestUserMessage,
      history: params.history,
    });

    if (input.tripwire) {
      this.logger.warn(`Input guardrail blocked the request: ${input.message}`);
      const text = input.message || "Unable to answer this request.";
      if (stream?.onToken) {
        await this.emitTokens(text, stream.onToken);
      }
      return { reply: text, intent: input.intent, retrieval: { snippets: [], references: [], dbTasks: [] } };
    }

    if (!this.llm.isEnabled()) {
      const fallback = "LLM is not configured. Cannot generate a response right now.";
      await this.emitTokens(fallback, stream?.onToken);
      return { reply: fallback, intent: input.intent, retrieval: { snippets: [], references: [], dbTasks: [] } };
    }

    const retrieval = await this.contextProvider.buildContext({
      projectId: params.project.id,
      query: input.rewritten || params.latestUserMessage,
      k: 6,
      intent: input.intent,
    });

    if (stream?.onEvent && retrieval.references.length > 0) {
      await stream.onEvent("references", retrieval.references);
    }

    const chatPrompt = this.composeUserPrompt({
      projectName: params.project.slug,
      projectDescription: params.project.description ?? "",
      message: input.rewritten || params.latestUserMessage,
      history: params.history,
      retrieval,
      intent: input.intent,
    });

    const draft = await this.llm.chatMarkdown(CHAT_AGENT_SYSTEM_PROMPT, chatPrompt);
    const output = await this.outputGuardrail.validateDraft({
      draftReply: draft,
      context: retrieval,
      intent: input.intent,
    });

    const finalText = output.tripwire ? output.message || "Reply blocked." : output.patched_reply || draft;
    await this.emitTokens(finalText, stream?.onToken);

    return { reply: finalText, intent: input.intent, retrieval };
  }

  private async emitTokens(text: string, emitter?: (token: string) => Promise<void> | void) {
    if (!emitter) return;
    const chunks = this.chunkForStream(text);
    for (const chunk of chunks) {
      await emitter(chunk);
    }
  }

  private chunkForStream(text: string): string[] {
    const result: string[] = [];
    let idx = 0;
    while (idx < text.length) {
      const next = text.slice(idx, idx + STREAM_CHUNK_SIZE);
      result.push(next);
      idx += STREAM_CHUNK_SIZE;
    }
    if (result.length === 0) result.push(text);
    return result;
  }

  private composeUserPrompt(input: {
    projectName: string;
    projectDescription: string;
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    retrieval: RetrievalBundle;
    intent: GuardrailIntent;
  }): string {
    const header = [
      `Project: ${input.projectName}`,
      `Description: ${input.projectDescription || "N/A"}`,
      `Intent: ${input.intent}`,
    ].join("\n");

    const history = input.history
      .slice(-6)
      .map((turn, idx) => `${idx + 1}. ${turn.role.toUpperCase()}: ${turn.content}`)
      .join("\n\n");

    const context = input.retrieval.snippets
      .map((snippet, idx) => {
        return [
          `#${idx + 1}`,
          `itemId=${snippet.itemId}`,
          `kind=${snippet.kind}`,
          snippet.title ? `title=${snippet.title}` : undefined,
          `distance=${snippet.distance.toFixed(4)}`,
          "snippet:",
          snippet.snippet,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const tasks = input.retrieval.dbTasks
      .map((task, idx) => `- [${task.status}] ${task.title}${task.dueDate ? ` (due ${task.dueDate.slice(0, 10)})` : ""}`)
      .join("\n");

    const lines = [
      header,
      "",
      "# Latest user prompt",
      input.message,
    ];

    if (history) {
      lines.push("", "# Recent conversation", history);
    }

    if (context) {
      lines.push("", "# Retrieved context", context);
    }

    if (tasks) {
      lines.push("", "# Authoritative tasks", tasks);
    }

    lines.push("", "# Output requirements", "Follow the system instructions exactly, including YAML tail.");

    return lines.join("\n");
  }
}

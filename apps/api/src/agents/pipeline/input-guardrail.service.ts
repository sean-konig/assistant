import { Inject, Injectable, Logger } from "@nestjs/common";
import { OpenAiService } from "../../llm/openai.service";
import { INPUT_GUARDRAIL_SYSTEM_PROMPT } from "./prompts";
import { ChatTurn, InputGuardrailRequest, InputGuardrailResponse, GuardrailIntent } from "./types";

@Injectable()
export class InputGuardrailService {
  private readonly logger = new Logger(InputGuardrailService.name);

  constructor(@Inject(OpenAiService) private readonly llm: OpenAiService) {}

  async evaluate(request: InputGuardrailRequest): Promise<InputGuardrailResponse> {
    this.logger.debug(`Evaluating input guardrail for project=${request.projectSlug}`);

    if (!this.llm.isEnabled()) {
      this.logger.warn("OpenAI client is not configured; bypassing input guardrail");
      return {
        tripwire: false,
        message: "Guardrail disabled; passing through.",
        rewritten: request.userPrompt,
        intent: this.deriveFallbackIntent(request.userPrompt),
      };
    }

    const payload = {
      projectId: request.projectId,
      projectSlug: request.projectSlug,
      userPrompt: request.userPrompt,
      lastTurns: this.serialiseHistory(request.history ?? []),
    };

    try {
      const userContent = JSON.stringify(payload, null, 2);
      const response = await this.llm.chatMarkdown(INPUT_GUARDRAIL_SYSTEM_PROMPT, userContent);
      const parsed = JSON.parse(response) as Partial<InputGuardrailResponse>;

      const tripwire = Boolean(parsed.tripwire);
      const intent = this.normaliseIntent(parsed.intent);
      const rewritten = typeof parsed.rewritten === "string" && parsed.rewritten.trim().length > 0
        ? parsed.rewritten.trim()
        : request.userPrompt;
      const message = typeof parsed.message === "string" && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : tripwire
          ? "Request blocked"
          : "Safe to continue";

      return {
        tripwire,
        message,
        rewritten,
        intent,
      };
    } catch (error) {
      this.logger.error("Input guardrail failed; defaulting to pass-through", error as Error);
      return {
        tripwire: false,
        message: "Guardrail error; passing through",
        rewritten: request.userPrompt,
        intent: this.deriveFallbackIntent(request.userPrompt),
      };
    }
  }

  private serialiseHistory(history: ChatTurn[]): Array<{ role: string; content: string }> {
    return history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
  }

  private deriveFallbackIntent(prompt: string): GuardrailIntent {
    const lower = prompt.toLowerCase();
    if (/(status|progress|update)/.test(lower)) return "status";
    if (/(plan|roadmap|next step)/.test(lower)) return "plan";
    if (/(task|todo|action)/.test(lower)) return "task_query";
    if (/(meeting|prep|agenda)/.test(lower)) return "meeting_prep";
    return "general_q";
  }

  private normaliseIntent(intent: unknown): GuardrailIntent {
    const allowed: GuardrailIntent[] = ["status", "plan", "task_query", "meeting_prep", "general_q"];
    const normalised = typeof intent === "string" ? intent.toLowerCase().trim() : "";
    if (allowed.includes(normalised as GuardrailIntent)) {
      return normalised as GuardrailIntent;
    }
    return "general_q";
  }
}

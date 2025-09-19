import { Inject, Injectable, Logger } from "@nestjs/common";
import { OpenAiService } from "../../llm/openai.service";
import { OUTPUT_GUARDRAIL_SYSTEM_PROMPT } from "./prompts";
import { OutputGuardrailRequest, OutputGuardrailResponse } from "./types";

@Injectable()
export class OutputGuardrailService {
  private readonly logger = new Logger(OutputGuardrailService.name);

  constructor(@Inject(OpenAiService) private readonly llm: OpenAiService) {}

  async validateDraft(request: OutputGuardrailRequest): Promise<OutputGuardrailResponse> {
    this.logger.debug("Running output guardrail");

    if (!this.llm.isEnabled()) {
      this.logger.warn("OpenAI client is not configured; skipping output guardrail");
      return { tripwire: false, message: "Guardrail disabled", patched_reply: request.draftReply };
    }

    try {
      const payload = {
        intent: request.intent,
        draftReply: request.draftReply,
        context: request.context,
      };
      const response = await this.llm.chatMarkdown(OUTPUT_GUARDRAIL_SYSTEM_PROMPT, JSON.stringify(payload, null, 2));
      const parsed = JSON.parse(response) as Partial<OutputGuardrailResponse>;

      const tripwire = Boolean(parsed.tripwire);
      const message = typeof parsed.message === "string" && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : tripwire
          ? "Reply blocked"
          : "Reply approved";
      const patched = typeof parsed.patched_reply === "string" && parsed.patched_reply.trim().length > 0
        ? parsed.patched_reply
        : request.draftReply;

      return { tripwire, message, patched_reply: patched };
    } catch (error) {
      this.logger.error("Output guardrail failed; returning original reply", error as Error);
      return { tripwire: false, message: "Guardrail error; returning original reply", patched_reply: request.draftReply };
    }
  }
}

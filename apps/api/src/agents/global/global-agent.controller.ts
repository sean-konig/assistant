import { BadRequestException, Controller, Get, Inject, Logger, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { GlobalAgentService, GlobalConversationResult } from "./global-agent.service";
import { SupabaseJwtGuard } from "../../common/guards/supabase-jwt.guard";
import { DigestsService } from "../../digests/digests.service";
import { GetUser } from "../../common/decorators/get-user.decorator";
import type { RequestUser } from "../../common/decorators/get-user.decorator";
import { createSse } from "../../common/http/sse";

@ApiTags("agent-global")
// @ApiBearerAuth("bearer")
// @UseGuards(SupabaseJwtGuard)
@Controller("agent/global")
export class GlobalAgentController {
  private readonly logger = new Logger(GlobalAgentController.name);

  constructor(
    @Inject(GlobalAgentService) private readonly globalAgent: GlobalAgentService,
    @Inject(DigestsService) private readonly digests: DigestsService
  ) {}

  @Get("digest")
  async generateDigest(
    @Query("date") date: string | undefined,
    @Query("persist") persist: string | undefined,
    @GetUser() user: RequestUser
  ) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException("date must be YYYY-MM-DD");
    }
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const userId = user?.id ?? process.env.DEV_USER_ID ?? 'seankonig';
    const result = await this.globalAgent.generateDailyDigest(userId, targetDate);

    const shouldPersist = typeof persist === "string" && ["1", "true", "yes"].includes(persist.toLowerCase());
    if (shouldPersist) {
      try {
        await this.digests.saveGlobalDigest(userId, result.payload);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`[GLOBAL:DIGEST] Failed to persist digest for ${targetDate}`, err);
      }
    }

    return {
      date: result.payload.date,
      markdown: result.payload.markdown,
      intent: result.payload.intent,
      sections: result.payload.sections,
      actions: result.payload.actions,
      references: result.payload.references,
      followups: result.payload.followups,
      guardrails: result.conversation.guardrails,
      persisted: shouldPersist,
    };
  }

  @Get("chat/stream")
  async chatStream(
    @Query("message") message: string,
    @Query("date") date: string | undefined,
    @Res() res: any,
    @Req() req: any,
    @GetUser() user: RequestUser
  ) {
    if (!message || typeof message !== "string" || message.length > 6000) {
      throw new BadRequestException("message is required and must be <= 6000 chars");
    }

    const sse = createSse(res, req, { pingMs: 15000 });
    try {
      const userId = user?.id ?? process.env.DEV_USER_ID ?? 'seankonig';
      const iterator = this.globalAgent
        .streamConversation(userId, message, { timeHint: date })
        [Symbol.asyncIterator]();

      let finalResult: GlobalConversationResult | undefined;
      let streaming = true;
      while (streaming) {
        const { value, done } = await iterator.next();
        if (done) {
          finalResult = value as GlobalConversationResult;
          streaming = false;
        } else {
          const token = String(value ?? "");
          if (token) sse.write({ token });
        }
      }

      const summary = finalResult ?? null;
      if (summary?.references?.length) {
        sse.write({ refs: summary.references });
      }
      const payload = summary
        ? {
            reply: summary.reply,
            intent: summary.intent,
            references: summary.references ?? [],
            proposedTasks: summary.proposedTasks ?? [],
            proposedNotes: summary.proposedNotes ?? [],
            proposedReminders: summary.proposedReminders ?? [],
            actions: summary.actions ?? [],
            guardrails: summary.guardrails,
          }
        : {
            reply: "",
            intent: "general_q",
            references: [],
            proposedTasks: [],
            proposedNotes: [],
            proposedReminders: [],
            actions: [],
            guardrails: undefined,
          };
      sse.write({ final: payload });
      sse.write({ done: true });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "global stream failed";
      sse.write({ error: messageText });
    } finally {
      sse.close(5);
    }
  }
}

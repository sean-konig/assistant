import { Controller, Get, Inject, Query, Res, Req } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAiService } from "../llm/openai.service";
import { createSse } from "../common/http/sse";

@Controller("core")
export class CoreAgentController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenAiService) private readonly llm: OpenAiService
  ) {}

  @Get("chat/stream")
  async chatStream(@Query("message") message: string, @Res() res: any, @Req() req: any) {
    console.log("Core chat/stream got message:", message);
    const sse = createSse(res, req, { pingMs: 15000 });
    let full = "";
    try {
      await this.llm.streamChatMarkdown(
        "You are the Core Orchestrator agent. Be concise, helpful, and use markdown.",
        message,
        (delta) => {
          full += delta;
          sse.write({ token: delta });
        }
      );
      sse.write({ done: true });
    } catch (e: any) {
      sse.write({ error: e?.message || "stream failed" });
    } finally {
      sse.close(5);
    }
  }
}

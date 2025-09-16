import { Controller, Get, Inject, Query, Res, Req, Options } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from '../llm/openai.service';

@Controller('core')
export class CoreAgentController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenAiService) private readonly llm: OpenAiService,
  ) {}

  @Get('chat/stream')
  async chatStream(@Query('message') message: string, @Res() res: any, @Req() req: any) {
    const origin = (req?.headers?.origin as string) || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-cache, no-transform');
    res.header('Connection', 'keep-alive');
    res.header('X-Accel-Buffering', 'no');
    if (typeof res.raw.flushHeaders === 'function') {
      res.raw.flushHeaders();
    }
    res.raw.write(': connected\n\n');
    const write = (data: any) => res.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    let full = '';
    const ping = setInterval(() => {
      try { res.raw.write(': ping\n\n'); } catch {}
    }, 15000);
    try {
      await this.llm.streamChatMarkdown(
        'You are the Core Orchestrator agent. Be concise, helpful, and use markdown.',
        message,
        (delta) => {
          full += delta;
          write({ token: delta });
        },
      );
      write({ done: true });
    } catch (e: any) {
      write({ error: e?.message || 'stream failed' });
    } finally {
      clearInterval(ping);
      setTimeout(() => res.raw.end(), 5);
    }
  }

  @Options('chat/stream')
  async preflight(@Res() res: any, @Req() req: any) {
    const origin = (req?.headers?.origin as string) || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.status(204).send();
  }
}

import { Body, Controller, Get, Inject, Param, Post, Query, Res, Req, Options } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProjectsService } from "./projects.service";
import type { CreateProjectReq, Project } from "@repo/types";
import { EmbeddingsService } from "../embeddings/embeddings.service";
import { ProjectAgent } from "../agents/project-agent.service";
import { OpenAiService } from "../llm/openai.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("projects")
@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
    @Inject(ProjectAgent) private readonly agent: ProjectAgent,
    @Inject(OpenAiService) private readonly llm: OpenAiService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Body() dto: CreateProjectReq): Promise<Project> {
    const slug = (dto.code ?? dto.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    const created = await this.projects.create("seank", { name: dto.name, slug });
    return this.projects.mapToProject(created);
  }

  @Get()
  async list(): Promise<Project[]> {
    const rows = await this.projects.listLocal();
    return rows.map((p) => this.projects.mapToProject(p));
  }

  @Get(":code")
  async get(@Param("code") code: string): Promise<any> {
    const row = await this.projects.getLocalBySlug(code);
    const base = this.projects.mapToProject(row);
    const details = await this.projects.getProjectDetails(row.id);
    return { ...base, ...details };
  }

  @Post(":code/notes")
  async addNote(
    @Param("code") code: string,
    @Body()
    body: {
      markdown: string;
      summaryMarkdown?: string;
      tags?: string[];
      authorEmail?: string;
      noteType?: "MEETING" | "ONE_ON_ONE" | "DAILY" | "GENERAL" | "OTHER";
      vector?: number[];
      dim?: number;
    },
  ) {
    const project = await this.projects.getLocalBySlug(code);
    const note = await this.projects.createNote(project.userId, project.id, {
      markdown: body.markdown,
      summaryMarkdown: body.summaryMarkdown ?? null,
      tags: body.tags ?? [],
      authorEmail: body.authorEmail ?? null,
      noteType: body.noteType ?? "GENERAL",
    });
    if (body.vector && Array.isArray(body.vector)) {
      await this.embeddings.indexVector(project.userId, note.id, body.vector, body.dim ?? body.vector.length);
    }
    return note;
  }

  @Post(":code/tasks")
  async addTask(
    @Param("code") code: string,
    @Body()
    payload: {
      title: string;
      status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
      priority: number;
      dueDate?: string | null;
      source?: "MANUAL" | "EMAIL" | "MEETING";
    },
  ) {
    const project = await this.projects.getLocalBySlug(code);
    return this.projects.createTask(project.userId, project.id, payload);
  }

  @Post(":code/chat")
  async chat(@Param("code") code: string, @Body() payload: { message: string }) {
    const project = await this.projects.getLocalBySlug(code);
    await this.projects.appendChatMessage(project.userId, project.id, { role: "user", content: payload.message });
    const qa = await this.agent.qa(project.id, payload.message);
    await this.projects.appendChatMessage(project.userId, project.id, { role: "assistant", content: qa.answerMarkdown });
    return { reply: qa.answerMarkdown };
  }

  @Get(":code/chat/stream")
  async chatStream(
    @Param("code") code: string,
    @Query("message") message: string,
    @Res() res: any,
    @Req() req: any,
  ) {
    // Setup SSE headers
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
    // prime the stream
    res.raw.write(': connected\n\n');

    const write = (data: any) => res.raw.write(`data: ${JSON.stringify(data)}\n\n`);

    const ping = setInterval(() => {
      try { res.raw.write(': ping\n\n'); } catch {}
    }, 15000);
    try {
      const project = await this.projects.getLocalBySlug(code);
      await this.projects.appendChatMessage(project.userId, project.id, { role: 'user', content: message });

      // Build retrieval context (best-effort)
      let context = '';
      try {
        const vectors = await this.llm.embed([message]);
        const qvec = vectors?.[0];
        const qstr = qvec && qvec.length ? `[${qvec.join(',')}]` : null;
        const top = qstr ? ((await this.prisma.$queryRawUnsafe(
          'SELECT i.body, i.raw FROM embeddings e JOIN items i ON i.id = e."itemId" WHERE i."projectId" = $1 ORDER BY e.vector <-> $2::vector LIMIT 6',
          project.id,
          qstr,
        )) as any[]) : [];
        context = top.length ? top.map((t) => `- ${t.body || t.raw?.markdown || ''}`).join('\n') : '';
      } catch {
        context = '';
      }

      const system = 'You are the project-specific agent. Answer using only the provided context when relevant. Be concise.';
      const user = context ? `Question: ${message}\n\nContext:\n${context}` : message;

      let full = '';
      await this.llm.streamChatMarkdown(system, user, (delta) => {
        full += delta;
        write({ token: delta });
      });

      await this.projects.appendChatMessage(project.userId, project.id, { role: 'assistant', content: full });
      write({ done: true });
    } catch (e: any) {
      write({ error: e?.message || 'stream failed' });
    } finally {
      clearInterval(ping);
      setTimeout(() => res.raw.end(), 5);
    }
  }

  @Options(":code/chat/stream")
  async chatStreamPreflight(@Res() res: any, @Req() req: any) {
    const origin = (req?.headers?.origin as string) || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.status(204).send();
  }

  @Post(":code/agent/summarize-latest-notes")
  async summarizeLatest(@Param("code") code: string) {
    const project = await this.projects.getLocalBySlug(code);
    const latest = await this.projects.getLatestNoteId(project.id);
    if (!latest) return { ok: true, summarized: 0 };
    const res = await this.agent.summarizeNote(latest);
    return { ok: true, summarized: 1, ...res };
  }

  @Post(":code/agent/compute-risk")
  async computeRisk(@Param("code") code: string) {
    const project = await this.projects.getLocalBySlug(code);
    const row = await this.agent.computeRisk(project.id);
    return row;
  }
}

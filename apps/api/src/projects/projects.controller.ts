import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  Req,
  BadRequestException,
  Patch,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProjectsService } from "./projects.service";
import type { CreateProjectReq, Project } from "@repo/types";
import { ProjectAgentService } from "../agents/project-agent.service";
import { ProjectNotesService } from "./project-notes.service";
import { ProjectTasksService } from "./project-tasks.service";
import { ProjectChatService } from "./project-chat.service";
import { ProjectDetailsService } from "./project-details.service";
import { createSse } from "../common/http/sse";

@ApiTags("projects")
@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ProjectAgentService) private readonly projAgent: ProjectAgentService,
    @Inject(ProjectNotesService) private readonly notes: ProjectNotesService,
    @Inject(ProjectTasksService) private readonly tasks: ProjectTasksService,
    @Inject(ProjectChatService) private readonly chatSvc: ProjectChatService,
    @Inject(ProjectDetailsService) private readonly details: ProjectDetailsService
  ) {}

  // Basic agent mode: no RAG helpers

  // Light history clamp: keep last N turns, trim long turns, and enforce simple char budget
  private clampHistory(
    history: { role: "user" | "assistant"; content: string }[],
    opts?: { maxTurns?: number; charBudget?: number; perTurnMax?: number }
  ) {
    const maxTurns = opts?.maxTurns ?? 9;
    const charBudget = opts?.charBudget ?? 2000;
    const perTurnMax = opts?.perTurnMax ?? 600;
    // 1) Keep only the last maxTurns
    let trimmed = history.slice(Math.max(0, history.length - maxTurns));
    // 2) Trim each turn's content to perTurnMax (take most recent portion)
    trimmed = trimmed.map((t) => ({ ...t, content: (t.content ?? "").slice(-perTurnMax) }));
    // 3) Enforce overall budget by dropping oldest until within budget
    const total = () => trimmed.reduce((acc, t) => acc + (t.content?.length ?? 0), 0);
    while (trimmed.length > 0 && total() > charBudget) {
      trimmed.shift();
    }
    return trimmed;
  }

  @Post()
  async create(@Body() dto: CreateProjectReq): Promise<Project> {
    const slug = (dto.code ?? dto.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    const created = await this.projects.create("seank", { name: dto.name, slug, description: dto.description ?? null });
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
    const details = await this.details.getProjectDetails(row.id);
    return { ...base, ...details };
  }

  @Patch(":code")
  async update(
    @Param("code") code: string,
    @Body() body: { name?: string; code?: string; description?: string | null }
  ): Promise<Project> {
    const newSlug = body.code
      ? body.code
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
      : undefined;
    const userId = "seank"; // TODO: auth user
    const updated = await this.projects.updateBySlug(userId, code, {
      name: body.name,
      slug: newSlug,
      description: body.description ?? undefined,
    });
    return this.projects.mapToProject(updated);
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
    }
  ) {
    const project = await this.projects.getLocalBySlug(code);
    const note = await this.notes.create(project.userId, project.id, {
      markdown: body.markdown,
      summaryMarkdown: body.summaryMarkdown ?? null,
      tags: body.tags ?? [],
      authorEmail: body.authorEmail ?? null,
      noteType: body.noteType ?? "GENERAL",
    });
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
    }
  ) {
    const project = await this.projects.getLocalBySlug(code);
    return this.tasks.create(project.userId, project.id, payload);
  }

  @Post(":code/chat")
  async chat(@Param("code") code: string, @Body() payload: { message: string }) {
    const project = await this.projects.getLocalBySlug(code);
    await this.chatSvc.appendMessage(project.userId, project.id, { role: "user", content: payload.message });
    const reply = await this.projAgent.replyOnce(
      { id: project.id, slug: project.slug, description: (project as any).description ?? null },
      payload.message
    );
    await this.chatSvc.appendMessage(project.userId, project.id, { role: "assistant", content: reply });
    return { reply };
  }

  // Agent (Agents SDK) — non-streaming helper
  @Post(":code/agent/chat")
  async projectAgentChat(@Param("code") code: string, @Body() body: { message: string }) {
    if (!body?.message || typeof body.message !== "string" || body.message.length > 5000) {
      throw new BadRequestException("message is required and must be <= 5000 chars");
    }
    const project = await this.projects.getLocalBySlug(code);
    const reply = await this.projAgent.replyOnce(
      { id: project.id, slug: project.slug, description: (project as any).description ?? null },
      body.message
    );
    await this.chatSvc.appendMessage(project.userId, project.id, { role: "user", content: body.message });
    await this.chatSvc.appendMessage(project.userId, project.id, { role: "assistant", content: reply });
    return { reply };
  }

  // Agent (Agents SDK) — streaming (basic)
  @Get(":code/agent/chat/stream")
  async projectAgentChatStream(
    @Param("code") code: string,
    @Query("message") message: string,
    @Res() res: any,
    @Req() req: any
  ) {
    if (!message || message.length > 5000) {
      throw new BadRequestException("message is required and must be <= 5000 chars");
    }
    const sse = createSse(res, req, { pingMs: 15000 });
    try {
      const project = await this.projects.getLocalBySlug(code);
      await this.chatSvc.appendMessage(project.userId, project.id, { role: "user", content: message });
      // Load last 9 turns (excluding the one we just saved) to keep total ~10
      const historyRaw = await this.chatSvc.getRecent(project.id, 9);
      const history = this.clampHistory(historyRaw);
      let full = "";
      for await (const delta of this.projAgent.replyStreamWithHistory(
        { id: project.id, slug: project.slug, description: (project as any).description ?? null },
        message,
        history
      )) {
        full += delta;
        sse.write({ token: delta });
      }

      await this.chatSvc.appendMessage(project.userId, project.id, { role: "assistant", content: full });
      sse.write({ done: true });
    } catch (e: any) {
      sse.write({ error: e?.message || "stream failed" });
    } finally {
      sse.close(5);
    }
  }

  @Get(":code/chat/stream")
  async chatStream(@Param("code") code: string, @Query("message") message: string, @Res() res: any, @Req() req: any) {
    if (!message || message.length > 5000) {
      throw new BadRequestException("message is required and must be <= 5000 chars");
    }
    const sse = createSse(res, req, { pingMs: 15000 });
    try {
      const project = await this.projects.getLocalBySlug(code);
      await this.chatSvc.appendMessage(project.userId, project.id, { role: "user", content: message });
      const historyRaw = await this.chatSvc.getRecent(project.id, 9);
      const history = this.clampHistory(historyRaw);
      let full = "";
      for await (const delta of this.projAgent.replyStreamWithHistory(
        { id: project.id, slug: project.slug, description: (project as any).description ?? null },
        message,
        history
      )) {
        full += delta;
        sse.write({ token: delta });
      }

      await this.chatSvc.appendMessage(project.userId, project.id, { role: "assistant", content: full });
      sse.write({ done: true });
    } catch (e: any) {
      sse.write({ error: e?.message || "stream failed" });
    } finally {
      sse.close(5);
    }
  }

  // RAG-enabled Agent endpoints (with vector context retrieval)
  @Post(":code/agent/rag/chat")
  async projectAgentRagChat(@Param("code") code: string, @Body() body: { message: string }) {
    if (!body?.message || typeof body.message !== "string" || body.message.length > 5000) {
      throw new BadRequestException("message is required and must be <= 5000 chars");
    }

    console.log(`[RAG-ENDPOINT] 📨 RAG Chat request for project "${code}"`);
    console.log(
      `[RAG-ENDPOINT] 💬 User message: "${body.message.slice(0, 100)}${body.message.length > 100 ? "..." : ""}"`
    );

    const project = await this.projects.getLocalBySlug(code);

    // Load recent chat history
    const historyRaw = await this.chatSvc.getRecent(project.id, 9);
    const history = this.clampHistory(historyRaw);

    console.log(`[RAG-ENDPOINT] 📚 Loaded ${history.length} history messages`);

    // Use RAG streaming method but collect full response
    let full = "";
    for await (const delta of this.projAgent.replyStreamWithHistoryAndRag(
      { id: project.id, slug: project.slug, description: (project as any).description ?? null },
      body.message,
      history
    )) {
      full += delta;
    }

    await this.chatSvc.appendMessage(project.userId, project.id, { role: "user", content: body.message });
    await this.chatSvc.appendMessage(project.userId, project.id, { role: "assistant", content: full });

    console.log(`[RAG-ENDPOINT] ✅ RAG Chat completed, response length: ${full.length} chars`);
    return { reply: full };
  }

  @Get(":code/agent/rag/chat/stream")
  async projectAgentRagChatStream(
    @Param("code") code: string,
    @Query("message") message: string,
    @Res() res: any,
    @Req() req: any
  ) {
    if (!message || message.length > 5000) {
      throw new BadRequestException("message is required and must be <= 5000 chars");
    }

    console.log(`[RAG-STREAM] 🌊 RAG Streaming request for project "${code}"`);
    console.log(`[RAG-STREAM] 💬 User message: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`);

    const sse = createSse(res, req, { pingMs: 15000 });
    try {
      const project = await this.projects.getLocalBySlug(code);
      await this.chatSvc.appendMessage(project.userId, project.id, { role: "user", content: message });

      // Load last 9 turns (excluding the one we just saved) to keep total ~10
      const historyRaw = await this.chatSvc.getRecent(project.id, 9);
      const history = this.clampHistory(historyRaw);

      console.log(`[RAG-STREAM] 📚 Loaded ${history.length} history messages, starting RAG stream...`);

      let full = "";
      for await (const delta of this.projAgent.replyStreamWithHistoryAndRag(
        { id: project.id, slug: project.slug, description: (project as any).description ?? null },
        message,
        history
      )) {
        full += delta;
        sse.write({ token: delta });
      }

      await this.chatSvc.appendMessage(project.userId, project.id, { role: "assistant", content: full });
      console.log(`[RAG-STREAM] ✅ RAG Stream completed, response length: ${full.length} chars`);
      sse.write({ done: true });
    } catch (e: any) {
      console.error(`[RAG-STREAM] ❌ RAG Stream error:`, e);
      sse.write({ error: e?.message || "RAG stream failed" });
    } finally {
      sse.close(5);
    }
  }

  @Post(":code/agent/summarize-latest-notes")
  async summarizeLatest(@Param("code") code: string) {
    const project = await this.projects.getLocalBySlug(code);
    const latest = await this.notes.getLatestNoteId(project.id);
    if (!latest) return { ok: true, summarized: 0 };
    const res = await this.projAgent.summarizeNote(latest);
    return { ok: true, summarized: 1, ...res };
  }

  @Post(":code/agent/compute-risk")
  async computeRisk(@Param("code") code: string) {
    const project = await this.projects.getLocalBySlug(code);
    const row = await this.projAgent.computeRisk(project.id);
    return row;
  }
}

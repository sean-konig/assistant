import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProjectsService } from "./projects.service";
import type { CreateProjectReq, Project } from "@repo/types";
import { EmbeddingsService } from "../embeddings/embeddings.service";

@ApiTags("projects")
@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
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
    const reply = `Project-specific agent (stub): I received your message about ${code}.`;
    await this.projects.appendChatMessage(project.userId, project.id, { role: "assistant", content: reply });
    return { reply };
  }
}

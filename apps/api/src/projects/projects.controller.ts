import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ProjectsService } from "./projects.service";
import type { CreateProjectReq, Project } from "@repo/types";

@ApiTags("projects")
@Controller("projects")
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

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
  async get(@Param("code") code: string): Promise<Project> {
    const row = await this.projects.getLocalBySlug(code);
    return this.projects.mapToProject(row);
  }
}

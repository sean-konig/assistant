import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Project as ProjectType } from "@repo/types";

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, data: { name: string; slug: string }) {
    try {
      return await this.prisma.project.create({ data: { ...data, userId } });
    } catch (e: any) {
      if (e.code === "P2002") throw new ConflictException("Project slug already exists");
      throw e;
    }
  }

  list(userId: string) {
    console.log("Listing projects for user:", userId);
    return this.prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async listLocal() {
    const userId = "seank"; // TODO: replace with real auth
    return this.list(userId);
  }

  async getLocalBySlug(slug: string) {
    const userId = "seank"; // TODO: replace with real auth
    const row = await this.prisma.project.findFirst({ where: { userId, slug } });
    if (!row) throw new NotFoundException("Project not found");
    return row;
  }

  // Map DB row -> shared API shape
  mapToProject(row: { id: string; name: string; slug: string; createdAt: Date; updatedAt: Date }): ProjectType {
    return {
      id: row.id,
      name: row.name,
      code: row.slug,
      status: "ACTIVE",
      riskScore: 0,
      openTasks: null,
      owner: null,
      nextDueDate: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

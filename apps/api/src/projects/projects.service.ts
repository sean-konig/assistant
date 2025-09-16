import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Project as ProjectType } from "@repo/types";

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, data: { name: string; slug: string; description?: string | null }) {
    try {
      return await this.prisma.project.create({ data: { name: data.name, slug: data.slug, description: data.description ?? null, userId } });
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
  mapToProject(row: { id: string; name: string; slug: string; description?: string | null; createdAt: Date; updatedAt: Date }): ProjectType {
    return {
      id: row.id,
      name: row.name,
      code: row.slug,
      description: row.description ?? null,
      status: "ACTIVE",
      riskScore: 0,
      openTasks: null,
      owner: null,
      nextDueDate: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateBySlug(userId: string, slug: string, data: { name?: string; slug?: string; description?: string | null }) {
    const existing = await this.prisma.project.findFirst({ where: { userId, slug } });
    if (!existing) throw new NotFoundException("Project not found");
    const updated = await this.prisma.project.update({
      where: { id: existing.id },
      data: {
        name: data.name ?? undefined,
        slug: data.slug ?? undefined,
        description: data.description === undefined ? undefined : data.description,
      },
    });
    return updated;
  }

  async getProjectDetails(projectId: string) {
    const items: any[] = await this.prisma.$queryRawUnsafe(
      'SELECT id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt" FROM items WHERE "projectId" = $1 ORDER BY "createdAt" DESC',
      projectId,
    );
    const notes = items
      .filter((i) => i.type === "NOTE" && (i as any).raw?.kind !== "TASK" && (i as any).raw?.kind !== "CHAT")
      .map((i) => ({
        id: i.id,
        projectCode: undefined,
        meetingId: undefined,
        authorEmail: (i as any).raw?.authorEmail ?? undefined,
        content: (i as any).raw?.markdown ?? i.body ?? i.title ?? "",
        summaryMarkdown: (i as any).raw?.summaryMarkdown ?? undefined,
        tags: ((i as any).raw?.tags ?? []) as string[],
        createdAt: i.createdAt.toISOString(),
      }));
    const tasks = items
      .filter((i) => (i as any).raw?.kind === "TASK")
      .map((i) => ({
        id: i.id,
        projectCode: undefined,
        title: i.title ?? i.body ?? "",
        status: ((i as any).raw?.status ?? "OPEN") as "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE",
        dueDate: (i as any).raw?.dueDate ?? null,
        priority: Number((i as any).raw?.priority ?? 0),
        source: ((i as any).raw?.source ?? "MANUAL") as "MANUAL" | "EMAIL" | "MEETING",
        updatedAt: i.updatedAt.toISOString(),
      }));
    // Meetings are not persisted yet; return empty collection
    const meetings: any[] = [];
    const chat = items
      .filter((i) => (i as any).raw?.kind === "CHAT")
      .map((i) => ({ id: i.id, role: (i as any).raw?.role ?? "assistant", content: i.body ?? "", createdAt: i.createdAt.toISOString() }))
      .reverse();
    return { notes, tasks, meetings, chat };
  }

  async getLatestNoteId(projectId: string): Promise<string | null> {
    const row = (await this.prisma.$queryRawUnsafe(
      'SELECT id, raw FROM items WHERE "projectId" = $1 AND type = $2 ORDER BY "createdAt" DESC LIMIT 1',
      projectId,
      'NOTE',
    )) as any[];
    if (!row[0]) return null;
    if (row[0].raw?.kind === 'NOTE') return row[0].id as string;
    return null;
  }

  async createNote(
    userId: string,
    projectId: string,
    data: { markdown: string; summaryMarkdown: string | null; tags: string[]; authorEmail: string | null; noteType: string },
  ) {
    const plain = this.stripMarkdown(data.markdown).slice(0, 10_000);
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      'NOTE',
      null,
      plain,
      { kind: 'NOTE', markdown: data.markdown, summaryMarkdown: data.summaryMarkdown, tags: data.tags, authorEmail: data.authorEmail, noteType: data.noteType },
      null,
      now,
    );
    const created = { id, createdAt: now, updatedAt: now } as any;
    return {
      id: created.id,
      projectCode: undefined,
      meetingId: undefined,
      authorEmail: data.authorEmail ?? undefined,
      content: data.markdown,
      summaryMarkdown: data.summaryMarkdown ?? undefined,
      tags: data.tags,
      createdAt: created.createdAt.toISOString(),
    } as const;
  }

  private stripMarkdown(md: string): string {
    return md
      .replace(/```[\s\S]*?```/g, " ") // code blocks
      .replace(/`[^`]*`/g, " ") // inline code
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ") // images
      .replace(/\[[^\]]*\]\([^\)]*\)/g, (m) => m.replace(/\[[^\]]*\]\([^\)]*\)/g, "")) // links text
      .replace(/^#+\s+/gm, "") // headings
      .replace(/^>+\s?/gm, "") // blockquotes
      .replace(/[*_~`>#-]/g, " ") // md symbols
      .replace(/\s+/g, " ")
      .trim();
  }

  async createTask(
    userId: string,
    projectId: string,
    payload: {
      title: string;
      status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
      priority: number;
      dueDate?: string | null;
      source?: "MANUAL" | "EMAIL" | "MEETING";
    },
  ) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      'NOTE',
      payload.title,
      null,
      { kind: 'TASK', status: payload.status, priority: payload.priority, dueDate: payload.dueDate ?? null, source: payload.source ?? 'MANUAL' },
      null,
      now,
    );
    const created = { id, updatedAt: now } as any;
    return {
      id: created.id,
      projectCode: undefined,
      title: payload.title,
      status: payload.status,
      dueDate: payload.dueDate ?? null,
      priority: payload.priority,
      source: payload.source ?? "MANUAL",
      updatedAt: created.updatedAt.toISOString(),
    } as const;
  }

  async appendChatMessage(
    userId: string,
    projectId: string,
    msg: { role: "user" | "assistant"; content: string },
  ) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      'NOTE',
      null,
      msg.content,
      { kind: 'CHAT', role: msg.role },
      null,
      now,
    );
  }

  async getRecentChat(projectId: string, limit = 10): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const rows = (await this.prisma.$queryRawUnsafe(
      'SELECT body, raw, "createdAt" FROM items WHERE "projectId" = $1 AND raw->>\'kind\' = $2 ORDER BY "createdAt" DESC LIMIT $3',
      projectId,
      'CHAT',
      limit,
    )) as any[];
    const turns = rows.map((r) => ({ role: (r.raw?.role ?? 'assistant') as 'user' | 'assistant', content: r.body ?? '' }));
    // Return oldest -> newest
    return turns.reverse();
  }
}

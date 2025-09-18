import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmbeddingPipeline } from "../embeddings/embedding.pipeline";

@Injectable()
export class ProjectTasksService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmbeddingPipeline) private readonly embeddingPipeline: EmbeddingPipeline
  ) {}

  async create(
    userId: string,
    projectId: string,
    payload: {
      title: string;
      status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
      priority: number;
      dueDate?: string | null;
      source?: "MANUAL" | "EMAIL" | "MEETING";
    }
  ) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4::"ItemType",$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      "NOTE",
      payload.title,
      null,
      {
        kind: "TASK",
        status: payload.status,
        priority: payload.priority,
        dueDate: payload.dueDate ?? null,
        source: payload.source ?? "MANUAL",
      },
      null,
      now
    );
    // Also create a Task row so it appears in the Tasks API immediately
    const mapStatus = (s: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE"): "todo" | "in_progress" | "done" => {
      switch (s) {
        case "OPEN":
          return "todo";
        case "IN_PROGRESS":
        case "BLOCKED": // no explicit 'blocked' in schema; treat as in_progress
          return "in_progress";
        case "DONE":
          return "done";
        default:
          return "todo";
      }
    };
    const mapPriorityBucket = (p: number) => {
      // UI: 3=highest -> P0, 2 -> P1, 1 -> P2, 0 -> P3
      if (p >= 3) return "P0";
      if (p === 2) return "P1";
      if (p === 1) return "P2";
      return "P3";
    };

    await this.prisma.task.create({
      data: {
        userId,
        projectId,
        title: payload.title,
        description: null,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        status: mapStatus(payload.status),
        priorityBucket: mapPriorityBucket(payload.priority),
        sourceItemId: id,
        signals: [],
      },
    });

    const created = { id, updatedAt: now } as any;

    // Non-blocking: generate embedding for the created task item
    try {
      const text = [
        payload.title,
        `status: ${payload.status}`,
        `priority: ${payload.priority}`,
        payload.dueDate ? `due: ${payload.dueDate}` : undefined,
        payload.source ? `source: ${payload.source}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
      if (text) {
        void this.embeddingPipeline
          .generateAndIndex(userId, projectId, id, text)
          .catch((err) => console.warn(`[ProjectTasks] embedding failed: ${err?.message || err}`));
      }
    } catch (e) {
      console.warn(`[ProjectTasks] embedding pipeline unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }

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
}

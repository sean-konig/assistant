import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IngestProcessor } from "../ingest/ingest-processor.service";
import {
  GetTasksQueryDto,
  TaskResponseDto,
  RescoreTasksResponseDto,
  CreateTaskDto,
  UpdateTaskDto,
} from "./dto/task.dto";
import { EmbeddingPipeline } from "../embeddings/embedding.pipeline";

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IngestProcessor) private readonly ingestProcessor: IngestProcessor,
    @Inject(EmbeddingPipeline) private readonly embeddingPipeline: EmbeddingPipeline
  ) {
    this.logger.log(
      `TasksService initialized. prisma=${Boolean(prisma)} ingestProcessor=${Boolean(
        ingestProcessor
      )} embeddingPipeline=${Boolean(embeddingPipeline)}`
    );
  }

  private normalizeParam(value?: string): string | undefined {
    if (value == null) return undefined;
    const v = value.trim();
    if (!v) return undefined;
    const lower = v.toLowerCase();
    if (lower === "undefined" || lower === "null" || lower === "all") return undefined;
    return v;
  }

  async getTasks(userId: string, query: GetTasksQueryDto): Promise<TaskResponseDto[]> {
    const project = this.normalizeParam(query.project);
    const bucket = this.normalizeParam(query.bucket);
    const status = this.normalizeParam(query.status as any) as typeof query.status | undefined;
    const limit = this.normalizeParam(query.limit);

    // Parse bucket filter (P0,P1,P2,P3)
    const buckets = bucket
      ? bucket
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean)
      : undefined;

    // Parse limit
    const take = limit ? parseInt(limit, 10) : undefined;

    // If filtering by project name, resolve its id first to avoid invalid relation filter
    let projectId: string | undefined;
    if (project) {
      const proj = await this.prisma.project.findFirst({ where: { userId, name: project } });
      if (!proj) {
        // No matching project; return empty result set
        return [];
      }
      projectId = proj.id;
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
        ...(buckets && {
          priorityBucket: {
            in: buckets,
          },
        }),
        ...(status && { status }),
      },
      include: {
        project: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ priorityScore: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take,
    });

    return tasks.map(this.mapTaskToResponse);
  }

  async rescoreTasks(userId: string, project?: string): Promise<RescoreTasksResponseDto> {
    const normalizedProject = this.normalizeParam(project);
    this.logger.log(`Rescoring tasks for user ${userId}${normalizedProject ? ` in project ${normalizedProject}` : ""}`);

    // Find project ID if project name is provided
    let projectId: string | null = null;
    if (normalizedProject) {
      const proj = await this.prisma.project.findFirst({
        where: { userId, name: normalizedProject },
      });
      if (!proj) {
        throw new Error(`Project '${normalizedProject}' not found`);
      }
      projectId = proj.id;
    }

    // Get count of tasks before rescoring
    const taskCount = await this.prisma.task.count({
      where: {
        userId,
        ...(projectId && { projectId }),
        status: { not: "done" },
      },
    });

    if (taskCount === 0) {
      this.logger.log("No tasks to rescore");
      return { updated: 0 };
    }

    // Trigger prioritization via IngestProcessor
    await this.ingestProcessor.prioritizeTasks(userId, projectId);

    this.logger.log(`Rescored ${taskCount} tasks`);
    return { updated: taskCount };
  }

  async deleteTasks(userId: string, project?: string): Promise<{ deleted: number }> {
    const normalizedProject = this.normalizeParam(project);
    let projectId: string | undefined;
    if (normalizedProject) {
      const proj = await this.prisma.project.findFirst({ where: { userId, name: normalizedProject } });
      if (!proj) return { deleted: 0 };
      projectId = proj.id;
    }
    const whereClause: any = { userId, ...(projectId && { projectId }) };

    // Fetch associated task item ids so we can clean up Items and Embeddings
    // Use raw SQL here to avoid type mismatch when Prisma client isn't regenerated yet
    const rows = await this.prisma.$queryRawUnsafe<{ taskItemId: string | null }[]>(
      `SELECT "taskItemId" FROM tasks WHERE "userId" = $1${projectId ? ' AND "projectId" = $2' : ""}`,
      ...(projectId ? [userId, projectId] : [userId])
    );
    const itemIds = rows.map((r) => r.taskItemId).filter((id): id is string => Boolean(id));

    // Delete embeddings first (in case DB schema hasn't applied cascade yet)
    if (itemIds.length > 0) {
      await this.prisma.embedding.deleteMany({ where: { itemId: { in: itemIds } } });
      await this.prisma.item.deleteMany({ where: { id: { in: itemIds } } });
    }

    const res = await this.prisma.task.deleteMany({ where: whereClause });
    return { deleted: res.count };
  }

  async createTask(userId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    const statusMap = (s: CreateTaskDto["status"]): "todo" | "in_progress" | "done" => {
      switch (s) {
        case "OPEN":
          return "todo";
        case "IN_PROGRESS":
        case "BLOCKED":
          return "in_progress";
        case "DONE":
          return "done";
        default:
          return "todo";
      }
    };
    const bucketFromPriority = (p?: number | null): "P0" | "P1" | "P2" | "P3" | undefined => {
      if (p == null) return undefined;
      if (p >= 3) return "P0";
      if (p === 2) return "P1";
      if (p === 1) return "P2";
      return "P3";
    };

    // Resolve projectId if a slug is provided; otherwise allow null
    let projectId: string | null = null;
    const projectCode = this.normalizeParam(dto.projectCode);
    if (projectCode) {
      const proj = await this.prisma.project.findFirst({ where: { userId, slug: projectCode } });
      projectId = proj?.id ?? null;
    }

    // Create the Item that represents this Task (used for embeddings/search)
    const taskItem = await this.prisma.item.create({
      data: {
        userId,
        projectId,
        type: "TASK" as any,
        title: dto.title,
        body: null,
        occurredAt: dto.dueDate ? new Date(dto.dueDate) : null,
        raw: dto.source || dto.signals ? { source: dto.source ?? "MANUAL", signals: dto.signals ?? [] } : undefined,
      },
    });

    // Create the Task and link the Item via taskItemId
    const created = await this.prisma.task.create({
      data: {
        userId,
        projectId,
        title: dto.title,
        description: null,
        owner: "me",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: statusMap(dto.status),
        priorityBucket: bucketFromPriority(dto.priority ?? undefined),
        signals: dto.signals ?? [],
        taskItemId: taskItem.id,
      } as any,
      include: { project: { select: { id: true, name: true, slug: true } } },
    });

    // Kick off embedding generation and indexing (non-blocking)
    try {
      const text = [created.title, created.description].filter(Boolean).join("\n\n");
      if (text) {
        void this.embeddingPipeline
          .generateAndIndex(userId, projectId, taskItem.id, text)
          .catch((err) => this.logger.warn(`Failed to index task embedding: ${err?.message || err}`));
      }
    } catch (err) {
      this.logger.warn(`Embedding pipeline not available: ${err instanceof Error ? err.message : String(err)}`);
    }

    return this.mapTaskToResponse(created);
  }

  private mapTaskToResponse(task: any): TaskResponseDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      owner: task.owner,
      dueDate: task.dueDate?.toISOString(),
      status: task.status,
      priorityScore: task.priorityScore,
      priorityBucket: task.priorityBucket,
      reason: task.reason,
      projectId: task.projectId,
      projectCode: task.project?.slug,
      sourceItemId: task.sourceItemId,
      signals: task.signals,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async updateTask(userId: string, id: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    // Fetch existing to resolve item linkage and current project
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        projectId: true,
        title: true,
        description: true,
        taskItemId: true,
        sourceItemId: true,
      },
    });
    if (!existing) throw new Error("Task not found");

    // Resolve new project id if projectCode provided
    let newProjectId: string | undefined;
    if (dto.projectCode) {
      const proj = await this.prisma.project.findFirst({ where: { userId, slug: dto.projectCode } });
      newProjectId = proj?.id;
    }

    const statusMap = (s?: UpdateTaskDto["status"]): "todo" | "in_progress" | "done" | undefined => {
      if (!s) return undefined;
      switch (s) {
        case "OPEN":
          return "todo";
        case "IN_PROGRESS":
        case "BLOCKED":
          return "in_progress";
        case "DONE":
          return "done";
      }
    };
    const bucketFromPriority = (p?: number | null): "P0" | "P1" | "P2" | "P3" | undefined => {
      if (p == null) return undefined;
      if (p >= 3) return "P0";
      if (p === 2) return "P1";
      if (p === 1) return "P2";
      return "P3";
    };

    // Update Task
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.status && { status: statusMap(dto.status) }),
        ...(dto.priority !== undefined && { priorityBucket: bucketFromPriority(dto.priority) }),
        ...(dto.signals && { signals: dto.signals }),
        ...(newProjectId && { projectId: newProjectId }),
      } as any,
      include: { project: { select: { id: true, name: true, slug: true } } },
    });

    // Update backing Item (taskItem preferred, else sourceItem)
    const itemId = existing.taskItemId ?? existing.sourceItemId;
    if (itemId) {
      await this.prisma.item.update({
        where: { id: itemId },
        data: {
          ...(dto.title != null && { title: dto.title }),
          ...(newProjectId && { projectId: newProjectId }),
          ...(dto.dueDate !== undefined && { occurredAt: dto.dueDate ? new Date(dto.dueDate) : null }),
          ...(dto.description !== undefined && { body: dto.description ?? null }),
        },
      });

      // Reindex embedding: delete old then index new
      try {
        const title = dto.title ?? updated.title ?? existing.title ?? "";
        const desc = dto.description ?? updated.description ?? existing.description ?? "";
        const text = [title, desc].filter(Boolean).join("\n\n");
        if (text) {
          await this.prisma.embedding.deleteMany({ where: { itemId } });
          await this.embeddingPipeline.generateAndIndex(
            userId,
            newProjectId ?? updated.projectId ?? existing.projectId ?? null,
            itemId,
            text
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to reindex task embedding: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return this.mapTaskToResponse(updated);
  }
}

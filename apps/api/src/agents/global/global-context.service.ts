import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmbeddingsService } from "../../embeddings/embeddings.service";

const DEFAULT_TOP_K = 8;
const VECTOR_DIM = 1536;
const DISTANCE_CUTOFF = 0.6;

export interface GlobalContextQuery {
  query?: string;
  date?: string;
  k?: number;
  intent?: string;
}

export interface GlobalContextSnippet {
  itemId: string;
  kind: string;
  title?: string | null;
  snippet: string;
  distance: number;
  projectId?: string | null;
}

export interface GlobalContextTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  projectId: string | null;
  projectSlug: string | null;
}

export interface GlobalContextMeeting {
  id: string;
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  projectId: string | null;
}

export interface GlobalContextRisk {
  projectId: string;
  projectSlug: string | null;
  score: number;
  label?: string | null;
  computedAt: string;
}

export interface GlobalContextResult {
  snippets: GlobalContextSnippet[];
  references: Array<{ itemId: string; confidence: number; projectId?: string | null }>;
  tasks: GlobalContextTask[];
  meetings: GlobalContextMeeting[];
  risks: GlobalContextRisk[];
}

@Injectable()
export class GlobalContextService {
  private readonly logger = new Logger(GlobalContextService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService
  ) {}

  async fetch(userId: string, input: GlobalContextQuery): Promise<GlobalContextResult> {
    const k = input.k && input.k > 0 ? Math.min(input.k, 20) : DEFAULT_TOP_K;
    const [snippets, tasks, meetings, risks] = await Promise.all([
      this.retrieveSnippets(userId, input.query ?? "", k),
      this.retrieveTasks(userId),
      this.retrieveMeetings(userId, input.date),
      this.retrieveRisks(userId),
    ]);

    this.logger.log(`[GLOBAL:CTX] snippets=${snippets.snippets.length} tasks=${tasks.length} meetings=${meetings.length} risks=${risks.length}`);

    return {
      snippets: snippets.snippets,
      references: snippets.references,
      tasks,
      meetings,
      risks,
    };
  }

  private async retrieveSnippets(userId: string, query: string, k: number): Promise<{
    snippets: GlobalContextSnippet[];
    references: Array<{ itemId: string; confidence: number; projectId?: string | null }>;
  }> {
    if (!query.trim()) {
      return { snippets: [], references: [] };
    }

    let embedding: number[] | undefined;
    try {
      [embedding] = await this.embeddings.embed([query]);
    } catch (error) {
      this.logger.error("[GLOBAL:CTX] embed failure", error as Error);
      return { snippets: [], references: [] };
    }

    if (!embedding || embedding.length !== VECTOR_DIM) {
      this.logger.warn(`[GLOBAL:CTX] invalid embedding length=${embedding?.length ?? 0}`);
      return { snippets: [], references: [] };
    }

    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        type: string;
        title: string | null;
        body: string | null;
        raw: any;
        distance: number;
        projectId: string | null;
      }>
    >(
      `SELECT i.id, i.type, i.title, i.body, i.raw, i."projectId", e.vector <-> $2::vector as distance
       FROM embeddings e
       JOIN items i ON i.id = e."itemId"
       WHERE e."userId" = $1 AND e."itemId" IS NOT NULL
       ORDER BY e.vector <-> $2::vector
       LIMIT ${k}`,
      userId,
      vectorLiteral
    );

    const snippets: GlobalContextSnippet[] = [];
    const references: Array<{ itemId: string; confidence: number; projectId?: string | null }> = [];

    for (const row of rows) {
      const distance = typeof row.distance === "number" ? row.distance : Number(row.distance);
      if (!Number.isFinite(distance) || distance > DISTANCE_CUTOFF) {
        continue;
      }
      const snippet = this.extractSnippet(row);
      if (!snippet) continue;
      snippets.push({
        itemId: row.id,
        kind: row.type,
        title: row.title,
        snippet,
        distance,
        projectId: row.projectId ?? null,
      });
      references.push({ itemId: row.id, confidence: Math.max(0, 1 - distance), projectId: row.projectId ?? null });
    }

    return { snippets, references };
  }

  private extractSnippet(row: { body: string | null; raw: any; title: string | null }): string | null {
    const raw = row.raw ?? {};
    const markdown = typeof raw?.markdown === "string" ? raw.markdown : null;
    const text = typeof raw?.text === "string" ? raw.text : null;
    const lines = Array.isArray(raw?.lines) ? (raw.lines as string[]).join("\n") : null;
    const body = row.body ?? null;
    const snippet = markdown || text || lines || body || row.title;
    if (!snippet) return null;
    return String(snippet).slice(0, 800);
  }

  private async retrieveTasks(userId: string): Promise<GlobalContextTask[]> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, status: { not: "done" } },
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { updatedAt: "desc" },
      ],
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        projectId: true,
        project: { select: { slug: true } },
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      projectId: task.projectId ?? null,
      projectSlug: task.project?.slug ?? null,
    }));
  }

  private async retrieveMeetings(userId: string, dateHint?: string): Promise<GlobalContextMeeting[]> {
    const date = this.resolveDate(dateHint);
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const meetings = await this.prisma.item.findMany({
      where: {
        userId,
        type: "CAL_EVENT",
        occurredAt: { gte: start, lt: end },
      },
      orderBy: { occurredAt: "asc" },
      select: { id: true, title: true, occurredAt: true, raw: true, projectId: true },
    });

    return meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title ?? (meeting.raw as any)?.title ?? null,
      startsAt: meeting.occurredAt ? meeting.occurredAt.toISOString() : null,
      endsAt: typeof (meeting.raw as any)?.end === "string" ? (meeting.raw as any).end : null,
      projectId: meeting.projectId ?? null,
    }));
  }

  private async retrieveRisks(userId: string): Promise<GlobalContextRisk[]> {
    const rows = await this.prisma.riskScore.findMany({
      where: { userId },
      orderBy: { computedAt: "desc" },
      select: {
        projectId: true,
        score: true,
        factors: true,
        computedAt: true,
        project: { select: { slug: true } },
      },
    });

    const latest = new Map<string, GlobalContextRisk>();
    for (const row of rows) {
      if (latest.has(row.projectId)) continue;
      latest.set(row.projectId, {
        projectId: row.projectId,
        projectSlug: row.project?.slug ?? null,
        score: row.score,
        label: this.extractRiskLabel(row.factors),
        computedAt: row.computedAt.toISOString(),
      });
    }
    return Array.from(latest.values());
  }

  private extractRiskLabel(factors: unknown): string | null {
    if (!factors || typeof factors !== "object") return null;
    const data = factors as Record<string, unknown>;
    if (typeof data.label === "string" && data.label.trim()) return data.label.trim();
    if (typeof data.reason === "string" && data.reason.trim()) return data.reason.trim();
    return null;
  }

  private resolveDate(input?: string): Date {
    if (!input) return new Date();
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  }
}

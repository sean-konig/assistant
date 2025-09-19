import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmbeddingsService } from "../../embeddings/embeddings.service";
import {
  ContextProviderRequest,
  RetrievalBundle,
  RetrievedSnippet,
  DbTaskSummary,
} from "./types";

const DEFAULT_TOP_K = 6;
const MAX_DISTANCE_THRESHOLD = 0.6;

@Injectable()
export class ContextProviderService {
  private readonly logger = new Logger(ContextProviderService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService
  ) {}

  async buildContext(request: ContextProviderRequest): Promise<RetrievalBundle> {
    const k = request.k ?? DEFAULT_TOP_K;
    this.logger.debug(`Retrieving context for project=${request.projectId} intent=${request.intent} k=${k}`);

    const snippets = await this.retrieveSnippets(request.projectId, request.query, k);
    const dbTasks = await this.retrieveDbTasks(request.projectId, request.intent, request.query);

    return {
      snippets: snippets.snippets,
      references: snippets.references,
      dbTasks,
    };
  }

  private async retrieveSnippets(projectId: string, query: string, k: number): Promise<{
    snippets: RetrievedSnippet[];
    references: Array<{ itemId: string; confidence: number }>;
  }> {
    if (!query.trim()) {
      return { snippets: [], references: [] };
    }

    let embedding: number[] | undefined;
    try {
      [embedding] = await this.embeddings.embed([query]);
    } catch (error) {
      this.logger.error("Failed to embed query for context retrieval", error as Error);
      return { snippets: [], references: [] };
    }

    if (!embedding || embedding.length !== 1536) {
      this.logger.warn(`Query embedding missing or wrong dimension: len=${embedding?.length ?? 0}`);
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
      }>
    >(
      `SELECT i.id, i.type, i.title, i.body, i.raw, e.vector <-> $2::vector as distance
       FROM embeddings e
       JOIN items i ON i.id = e."itemId"
       WHERE i."projectId" = $1
       ORDER BY e.vector <-> $2::vector
       LIMIT ${k}`,
      projectId,
      vectorLiteral
    );

    const snippets: RetrievedSnippet[] = [];
    const references: Array<{ itemId: string; confidence: number }> = [];

    for (const row of rows) {
      const distance = typeof row.distance === "number" ? row.distance : Number(row.distance);
      if (Number.isNaN(distance) || distance > MAX_DISTANCE_THRESHOLD) {
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
      });
      references.push({ itemId: row.id, confidence: Math.max(0, 1 - distance) });
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

  private async retrieveDbTasks(projectId: string, intent?: string, query?: string): Promise<DbTaskSummary[]> {
    const shouldFetch = intent === "task_query" || /task|todo|action/i.test(query ?? "");
    if (!shouldFetch) return [];

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, status: true, dueDate: true },
      take: 50,
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    }));
  }
}

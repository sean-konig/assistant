import { Inject, Injectable } from "@nestjs/common";
import { Prisma, ItemType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmbeddingsService } from "../embeddings/embeddings.service";

const CHUNK_SIZE_CHARS = 4000;
const CHUNK_OVERLAP_CHARS = 200;
const MAX_CHUNKS = 20;

interface IndexableItem extends Prisma.ItemGetPayload<{ include: { asTask: { select: { status: true; dueDate: true } } } }> {}

@Injectable()
export class IndexerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService
  ) {}

  async processItem(itemId: string): Promise<void> {
    if (!itemId) {
      return;
    }

    const startedAt = Date.now();
    console.log(`[INDEX] START item=${itemId}`);

    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: { asTask: { select: { status: true, dueDate: true } } },
    });

    if (!item) {
      console.log(`[INDEX] SKIP missing item=${itemId}`);
      return;
    }

    const text = this.buildTextForEmbedding(item as IndexableItem);
    if (!text || text.trim().length === 0) {
      console.log(`[INDEX] SKIP empty item=${itemId}`);
      await this.prisma.embedding.deleteMany({ where: { itemId } });
      return;
    }

    const chunks = this.chunk(text.trim());
    if (chunks.length === 0) {
      console.log(`[INDEX] SKIP no_chunks item=${itemId}`);
      await this.prisma.embedding.deleteMany({ where: { itemId } });
      return;
    }

    console.log(`[INDEX] CHUNKS n=${chunks.length} item=${itemId}`);

    let vectors: number[][];
    try {
      vectors = await this.embeddings.embed(chunks);
    } catch (err) {
      console.error(`[INDEX] EMBED_FAIL item=${itemId}`, err);
      return;
    }

    if (!Array.isArray(vectors) || vectors.length === 0) {
      console.log(`[INDEX] EMBED_EMPTY item=${itemId}`);
      return;
    }

    const dims = vectors[0]?.length ?? 0;
    console.log(`[INDEX] EMBED dims=${dims} item=${itemId}`);

    if (dims !== 1536) {
      console.warn(`[INDEX] WARN unexpected_dimension=${dims} item=${itemId}`);
    }

    await this.prisma.embedding.deleteMany({ where: { itemId } });

    let inserted = 0;
    for (const vector of vectors) {
      if (!Array.isArray(vector) || vector.length !== 1536) {
        console.warn(`[INDEX] SKIP vector_length=${vector?.length ?? "unknown"} item=${itemId}`);
        continue;
      }
      try {
        await this.embeddings.indexVector(item.userId, item.id, vector, 1536, item.projectId ?? null);
        inserted += 1;
      } catch (err) {
        console.error(`[INDEX] UPSERT_FAIL item=${itemId}`, err);
      }
    }

    console.log(`[INDEX] UPSERT rows=${inserted} item=${itemId}`);

    const duration = Date.now() - startedAt;
    console.log(`[INDEX] DONE item=${itemId} ms=${duration}`);
  }

  buildTextForEmbedding(item: IndexableItem): string {
    const title = (item.title ?? "").trim();
    switch (item.type) {
      case ItemType.TASK:
        return this.buildTaskText(item, title);
      case ItemType.NOTE:
      case ItemType.DOC:
        return this.buildDocumentText(item, title);
      default:
        return this.buildGenericText(item, title);
    }
  }

  private buildTaskText(item: IndexableItem, title: string): string {
    const task = item.asTask?.[0];
    const status = (task?.status ?? this.readRawString(item.raw, "status") ?? "unknown").toString();
    const dueDate = task?.dueDate ?? this.readRawDate(item.raw, "dueDate") ?? item.occurredAt ?? null;
    const due = dueDate ? this.formatDate(dueDate) : null;
    const parts = [title || "Untitled task", `[status: ${status}]`];
    if (due) parts.push(`[due: ${due}]`);
    const body = this.buildDocumentBody(item);
    if (body) {
      parts.push("\n\n" + body);
    }
    return parts.join(" ").trim();
  }

  private buildDocumentText(item: IndexableItem, title: string): string {
    const body = this.buildDocumentBody(item);
    return [title, body].filter(Boolean).join("\n\n").trim();
  }

  private buildGenericText(item: IndexableItem, title: string): string {
    const rawText = this.buildDocumentBody(item);
    const fallback = [title, item.body ?? "", rawText].filter((v) => typeof v === "string" && v.trim().length > 0);
    if (fallback.length === 0) {
      return title;
    }
    return Array.from(new Set(fallback)).join("\n\n");
  }

  private buildDocumentBody(item: IndexableItem): string {
    const raw = item.raw as Prisma.JsonObject | null | undefined;
    if (!raw) {
      return item.body ?? "";
    }
    const markdown = this.readRawString(raw, "markdown");
    if (markdown) return markdown;
    const text = this.readRawString(raw, "text") ?? this.readRawString(raw, "body");
    if (text) return text;
    if (Array.isArray(raw?.lines)) {
      return (raw.lines as string[]).join("\n");
    }
    return item.body ?? "";
  }

  private chunk(text: string): string[] {
    if (!text) return [];
    const chunks: string[] = [];
    const length = text.length;
    let start = 0;
    while (start < length && chunks.length < MAX_CHUNKS) {
      const end = Math.min(length, start + CHUNK_SIZE_CHARS);
      const piece = text.slice(start, end).trim();
      if (piece) {
        chunks.push(piece);
      }
      if (end >= length) {
        break;
      }
      start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
    }
    return chunks;
  }

  private readRawString(raw: Prisma.JsonValue | undefined, key: string): string | null {
    if (!raw || typeof raw !== "object" || raw === null) return null;
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
    if (val instanceof Date) return val.toISOString();
    return null;
  }

  private readRawDate(raw: Prisma.JsonValue | undefined, key: string): Date | null {
    const value = this.readRawString(raw, key);
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

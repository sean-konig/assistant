import { Injectable, forwardRef, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmbeddingPipeline } from "../embeddings/embedding.pipeline";

@Injectable()
export class ProjectChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => EmbeddingPipeline))
    private readonly embeddingPipeline: EmbeddingPipeline
  ) {
    console.log("[ProjectChatService] Constructor called", {
      hasPrisma: Boolean(this.prisma),
      hasEmbeddingPipeline: Boolean(this.embeddingPipeline),
    });
  }

  async appendMessage(userId: string, projectId: string, msg: { role: "user" | "assistant"; content: string }) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4::"ItemType",$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      "NOTE",
      null,
      msg.content,
      { kind: "CHAT", role: msg.role },
      null,
      now
    );

    // Fire-and-forget: embed non-trivial chat content for retrieval
    const text = (msg.content || "").trim();
    if (text.length >= 8) {
      try {
        await this.embeddingPipeline.generateAndIndex(userId, projectId, id, text);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("[embeddings] stored chat turn", { itemId: id, projectId });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("[embeddings] failed to store chat embedding", {
          itemId: id,
          projectId,
          error: err?.message || String(err),
        });
      }
    }
  }

  async getRecent(projectId: string, limit = 10): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const rows = (await this.prisma.$queryRawUnsafe(
      'SELECT body, raw, "createdAt" FROM items WHERE "projectId" = $1 AND raw->>\'kind\' = $2 ORDER BY "createdAt" DESC LIMIT $3',
      projectId,
      "CHAT",
      limit
    )) as any[];
    const turns = rows.map((r) => ({
      role: (r.raw?.role ?? "assistant") as "user" | "assistant",
      content: r.body ?? "",
    }));
    return turns.reverse();
  }
}

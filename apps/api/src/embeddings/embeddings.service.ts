import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAiService } from "../llm/openai.service";

@Injectable()
export class EmbeddingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenAiService) private readonly llm: OpenAiService
  ) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[EmbeddingsService] Constructor called", {
        hasPrisma: Boolean(this.prisma),
        hasLlm: Boolean(this.llm),
        prismaType: typeof this.prisma,
        hasQueryRaw: Boolean(this.prisma?.$queryRawUnsafe),
      });
    }
  }

  // Stores vector using raw SQL to ensure correct VECTOR type
  async indexVector(userId: string, itemId: string | null, vector: number[], dim = 1536, projectId?: string | null) {
    if (!Array.isArray(vector) || vector.length !== 1536) {
      throw new BadRequestException(
        `Embedding dimension must be 1536; got ${Array.isArray(vector) ? vector.length : "invalid"}`
      );
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[EmbeddingsService] About to insert embedding", {
        hasPrisma: Boolean(this.prisma),
        prismaType: typeof this.prisma,
        hasQueryRaw: Boolean(this.prisma?.$queryRawUnsafe),
        userId,
        itemId,
        projectId,
        vectorLength: vector.length,
      });
    }

    if (!this.prisma || typeof this.prisma.$queryRawUnsafe !== "function") {
      throw new Error(`PrismaService not properly injected: ${typeof this.prisma}`);
    }

    const result = await this.prisma.$queryRawUnsafe<[{ id: string }]>(
      `INSERT INTO embeddings ("userId", "projectId", "itemId", vector, dim, "createdAt") VALUES ($1, $2, $3, $4::vector, $5, now()) RETURNING id`,
      userId,
      projectId ?? null,
      itemId,
      `[${vector.join(",")}]`,
      1536
    );
    return { id: result[0]?.id };
  }

  // Convenience embedding wrapper used by agent RAG
  async embed(texts: string[]): Promise<number[][]> {
    return this.llm.embed(texts);
  }
}

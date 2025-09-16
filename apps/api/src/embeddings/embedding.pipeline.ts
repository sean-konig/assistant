import { Injectable, Inject } from "@nestjs/common";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";
import { createId } from "@paralleldrive/cuid2";

@Injectable()
export class EmbeddingPipeline {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    console.log("[EmbeddingPipeline] Constructor called", {
      hasPrisma: Boolean(this.prisma),
      prismaType: typeof this.prisma,
      prismaConstructor: this.prisma?.constructor?.name,
      hasQueryRawUnsafe: Boolean(this.prisma?.$queryRawUnsafe),
    });
  }

  async generateAndIndex(userId: string, projectId: string | null, itemId: string | null, textOrMarkdown: string) {
    const plain = this.stripMarkdown(textOrMarkdown).slice(0, 2000);

    // Get embedding using OpenAI directly
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key missing");

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

    const response = await client.embeddings.create({
      model,
      input: plain,
      encoding_format: "float",
    });

    const embedding = response.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Failed to get embedding from OpenAI");
    }

    const vector = embedding;
    const dim = vector.length;
    console.log(`[embeddings] Generated embedding with ${dim} dimensions for itemId: ${itemId}`);

    // Store in database using raw SQL
    try {
      const embeddingId = createId();
      const result = await this.prisma.$queryRawUnsafe<[{ id: string }]>(
        `INSERT INTO embeddings (id, "userId", "projectId", "itemId", vector, dim) VALUES ($1, $2, $3, $4, $5::vector, $6) RETURNING id`,
        embeddingId,
        userId,
        projectId,
        itemId,
        `[${vector.join(",")}]`,
        dim
      );

      const insertedId = result[0]?.id;
      console.log(`[embeddings] Successfully stored embedding with id: ${insertedId}`);

      return { dim, id: insertedId };
    } catch (error) {
      console.error("[embeddings] Failed to store embedding:", error);
      throw error;
    }
  }

  private stripMarkdown(md: string) {
    return md
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`]*`/g, " ")
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
      .replace(/\[[^\]]*\]\([^\)]*\)/g, " ")
      .replace(/^#+\s+/gm, "")
      .replace(/^>+\s?/gm, "")
      .replace(/[*_~`>#-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

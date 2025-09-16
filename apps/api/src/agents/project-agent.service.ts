import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmbeddingPipeline } from "../embeddings/embedding.pipeline";
import { OpenAiService } from "../llm/openai.service";

@Injectable()
export class ProjectAgent {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: EmbeddingPipeline,
    private readonly llm: OpenAiService
  ) {}

  async summarizeNote(itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Note not found");
    const markdown = (item as any).raw?.markdown || item.body || "";
    const result = await this.llm.summarizeNote(markdown);
    await this.prisma.item.update({
      where: { id: itemId },
      data: {
        raw: {
          ...(item as any).raw,
          summaryMarkdown: result.summaryMarkdown,
          tags: result.tags,
          noteType: result.noteType,
        },
      },
    });
    return result;
  }

  async embedNote(userId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("Note not found");
    const markdown = (item as any).raw?.markdown || item.body || "";
    return this.pipeline.generateAndIndex(userId, itemId, markdown);
  }

  async computeRisk(projectId: string) {
    // simple heuristic: open tasks + recent risk-tagged notes
    const items = await this.prisma.$queryRaw<
      any[]
    >`SELECT raw, "createdAt" FROM items WHERE "projectId" = ${projectId}`;
    const now = Date.now();
    const recentNotes = items.filter(
      (i) => i.raw?.kind === "NOTE" && (now - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 14
    );
    const riskTagCount = recentNotes.reduce(
      (acc, i) =>
        acc +
        (Array.isArray(i.raw?.tags) ? (i.raw.tags as string[]).filter((t) => /risk|block|issue/.test(t)).length : 0),
      0
    );
    const openTasks = items.filter((i) => i.raw?.kind === "TASK" && i.raw?.status !== "DONE").length;
    const score = Math.max(0, Math.min(100, openTasks * 10 + riskTagCount * 5));
    const factors = { openTasks, riskTagCount };
    const userId = (await this.prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } }))!
      .userId;
    const row = await this.prisma.riskScore.create({ data: { userId, projectId, score, factors } });
    return row;
  }

  async qa(projectId: string, query: string) {
    // Retrieve top-k by vector distance using OpenAI query embedding
    let top: any[] = [];
    try {
      const vectors = await this.llm.embed([query]);
      console.log("I got query:", query);
      console.log("Vectors:", vectors);
      const qvec = vectors?.[0];
      if (qvec && qvec.length) {
        const qstr = `[${qvec.join(",")}]`;
        top = (await this.prisma.$queryRawUnsafe(
          'SELECT e."itemId" as itemId, i.body, i.raw FROM embeddings e JOIN items i ON i.id = e."itemId" WHERE i."projectId" = $1 ORDER BY e.vector <-> $2::vector LIMIT 5',
          projectId,
          qstr
        )) as any[];
      }
    } catch {
      top = (await this.prisma.$queryRawUnsafe(
        'SELECT i.id as "itemId", i.body, i.raw FROM items i WHERE i."projectId" = $1 ORDER BY i."createdAt" DESC LIMIT 5',
        projectId
      )) as any[];
    }
    const context = top.map((t) => `- ${t.body || t.raw?.markdown || ""}`).join("\n");
    const sys =
      "You answer user questions about a single project using the given context only. Be friendly and responsive, but concise. If you do not know the answer, say you do not know and ask for the context to be added.";
    const answer = this.llm.isEnabled()
      ? await this.llm.chatMarkdown(sys, `Question: ${query}\n\nContext:\n${context}`)
      : `Stub answer for: ${query}`;
    return { answerMarkdown: answer, sources: top.map((t) => ({ itemId: t.itemId, score: 0 })) };
  }
}

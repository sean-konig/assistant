import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAiService } from "../llm/openai.service";
import {
  Agent,
  run,
  user,
  assistant as a,
  system as s,
  extractAllTextOutput,
  setDefaultOpenAIKey,
} from "@openai/agents";
import { buildProjectAgentInstructions } from "./instructions";

type ProjectLite = { id: string; slug: string; description?: string | null };

@Injectable()
export class ProjectAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: OpenAiService,
  ) {
    if (process.env.OPENAI_API_KEY) {
      setDefaultOpenAIKey(process.env.OPENAI_API_KEY);
    }
  }

  private createAgent(project: ProjectLite) {
    return new Agent({
      name: `project:${project.slug}`,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      instructions: buildProjectAgentInstructions({
        projectName: project.slug,
        projectDescription: project.description,
      }),
    });
  }

  // Non-stream variant
  async replyOnce(project: ProjectLite, message: string) {
    const agent = this.createAgent(project);
    const result = await run(agent, [user(message)], { context: { projectId: project.id } });
    return extractAllTextOutput(result.newItems);
  }

  // STREAMING: async generator of text chunks
  async *replyStream(project: ProjectLite, message: string) {
    const agent = this.createAgent(project);
    const streamed = await run(agent, [user(message)], { context: { projectId: project.id }, stream: true });
    const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });
    for await (const delta of textStream) {
      yield String(delta);
    }
  }

  // No history/RAG variants in the basic agent

  // Utilities we keep from the old service
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

  async computeRisk(projectId: string) {
    const items = await this.prisma.$queryRaw<any[]>`SELECT raw, "createdAt" FROM items WHERE "projectId" = ${projectId}`;
    const now = Date.now();
    const recentNotes = items.filter(
      (i) => i.raw?.kind === "NOTE" && (now - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 14,
    );
    const riskTagCount = recentNotes.reduce(
      (acc, i) =>
        acc + (Array.isArray(i.raw?.tags) ? (i.raw.tags as string[]).filter((t) => /risk|block|issue/.test(t)).length : 0),
      0,
    );
    const openTasks = items.filter((i) => i.raw?.kind === "TASK" && i.raw?.status !== "DONE").length;
    const score = Math.max(0, Math.min(100, openTasks * 10 + riskTagCount * 5));
    const factors = { openTasks, riskTagCount };
    const userId = (
      await this.prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } })
    )!.userId;
    const row = await this.prisma.riskScore.create({ data: { userId, projectId, score, factors } });
    return row;
  }
}

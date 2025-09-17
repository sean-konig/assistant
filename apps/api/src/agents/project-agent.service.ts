import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAiService } from "../llm/openai.service";
import { EmbeddingsService } from "../embeddings/embeddings.service";
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
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OpenAiService) private readonly llm: OpenAiService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService
  ) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[ProjectAgentService] Constructor called", {
        hasPrisma: Boolean(this.prisma),
        hasLlm: Boolean(this.llm),
        hasEmbeddings: Boolean(this.embeddings),
        embeddingsType: typeof this.embeddings,
        hasEmbedMethod: Boolean(this.embeddings?.embed),
      });
    }

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

  // Build message sequence from recent turns + latest user message
  private toMessageSequence(history: { role: "user" | "assistant"; content: string }[], latest: string) {
    const seq: any[] = [];
    for (const t of history) {
      if (t.role === "user") seq.push(user(t.content));
      else seq.push(a(t.content));
    }
    seq.push(user(latest));
    return seq;
  }

  // STREAMING with history (no RAG)
  async *replyStreamWithHistory(
    project: ProjectLite,
    latest: string,
    history: { role: "user" | "assistant"; content: string }[]
  ) {
    const agent = this.createAgent(project);
    const seq = this.toMessageSequence(history, latest);
    const streamed = await run(agent, seq, { context: { projectId: project.id }, stream: true });
    const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });
    for await (const delta of textStream) yield String(delta);
  }

  // RAG: Query time vector search to fetch top-k context
  async getTopKContext(projectId: string, query: string, k = 6): Promise<string[]> {
    try {
      console.log(`[RAG] Starting context retrieval for query: "${query.slice(0, 100)}..."`);
      console.log(`[RAG] Parameters: projectId=${projectId}, k=${k}`);
      console.log(`[RAG] Service dependency check:`, {
        hasEmbeddingsService: Boolean(this.embeddings),
        embeddingsType: typeof this.embeddings,
        hasEmbedMethod: Boolean(this.embeddings?.embed),
        embedMethodType: typeof this.embeddings?.embed,
      });

      if (!this.embeddings) {
        console.error(`[RAG] ❌ EmbeddingsService is undefined - dependency injection failed`);
        return [];
      }

      if (!this.embeddings.embed) {
        console.error(`[RAG] ❌ EmbeddingsService.embed method is undefined`);
        return [];
      }

      // Embed the query
      const [qvec] = await this.embeddings.embed([query]);
      if (!qvec?.length) {
        console.log(`[RAG] ❌ No embedding generated for query`);
        return [];
      }

      console.log(`[RAG] ✅ Generated query embedding with ${qvec.length} dimensions`);

      // Query with pgvector similarity search
      const qstr = `[${qvec.join(",")}]`;
      console.log(`[RAG] 🔍 Executing similarity search...`);

      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT i.body, i.raw, e.vector <-> $2::vector as distance
         FROM embeddings e
         JOIN items i ON i.id = e."itemId"
         WHERE e."projectId" = $1
         ORDER BY e.vector <-> $2::vector
         LIMIT ${k}`,
        projectId,
        qstr
      );

      console.log(`[RAG] 📊 Found ${rows.length} similarity matches from database`);

      // Extract content from results
      const contextSnippets = rows
        .map((r, idx) => {
          const content = r.body || r.raw?.markdown || "";
          const distance = parseFloat(r.distance || "1.0");
          console.log(`[RAG] Match ${idx + 1}: distance=${distance.toFixed(4)}, content_length=${content.length}`);
          return { content: content.trim(), distance };
        })
        .filter((item) => item.content.length > 0)
        .map((item, idx) => {
          const truncated = item.content.slice(0, 200);
          console.log(`[RAG] Context ${idx + 1}: "${truncated}${item.content.length > 200 ? "..." : ""}"`);
          return item.content;
        });

      console.log(`[RAG] ✅ Retrieved ${contextSnippets.length} valid context snippets`);
      return contextSnippets;
    } catch (error) {
      console.error("[RAG] ❌ Error retrieving context:", error);
      return [];
    }
  }

  // STREAMING with history AND RAG context
  async *replyStreamWithHistoryAndRag(
    project: ProjectLite,
    latest: string,
    history: { role: "user" | "assistant"; content: string }[],
    fetchContext?: (q: string) => Promise<string[]>
  ) {
    console.log(`[RAG] 🚀 Starting RAG pipeline for project "${project}"`);
    console.log(`[RAG] 📝 User query: "${latest}"`);
    console.log(`[RAG] 📚 Chat history length: ${history.length} messages`);

    const agent = this.createAgent(project);

    // Fetch relevant context using RAG
    console.log(`[RAG] 🔍 Searching for relevant context...`);
    const contextFetcher = fetchContext || ((q: string) => this.getTopKContext(project.id, q, 6));
    const contextSnippets = await contextFetcher(latest);

    console.log(`[RAG] 📊 Found ${contextSnippets.length} relevant context snippets`);
    if (contextSnippets.length > 0) {
      console.log(`[RAG] 📄 Context preview:`);
      contextSnippets.forEach((snippet, idx) => {
        const preview = snippet.slice(0, 100).replace(/\n/g, " ").trim();
        console.log(`[RAG]   ${idx + 1}. "${preview}${snippet.length > 100 ? "..." : ""}"`);
      });
    }

    // Build context block if we have relevant content
    const contextBlock = contextSnippets.length
      ? `Context (top ${contextSnippets.length}):\n` +
        contextSnippets.map((c, i) => `${i + 1}. ${c.slice(0, 200)}...`).join("\n")
      : "";

    console.log(`[RAG] 🏗️  Building context block (${contextBlock.length} chars):`, contextBlock ? "YES" : "NO");
    if (contextBlock) {
      console.log(
        `[RAG] 📋 Context block preview: "${contextBlock.slice(0, 200)}${contextBlock.length > 200 ? "..." : ""}"`
      );
    }

    // Build message sequence: system context + history + latest user message
    const seq: any[] = [];

    if (contextBlock) {
      const systemMessage = "Use the following context if relevant. If not relevant, ignore it.\n" + contextBlock;
      seq.push(s(systemMessage));
      console.log(`[RAG] 🤖 Added system context message (${systemMessage.length} chars)`);
    } else {
      console.log(`[RAG] ⚠️  No context found - proceeding without RAG augmentation`);
    }

    // Add chat history
    console.log(`[RAG] 💬 Adding ${history.length} history messages to conversation`);
    for (const h of history) {
      seq.push(h.role === "user" ? user(h.content) : a(h.content));
    }

    // Add latest user message
    seq.push(user(latest));
    console.log(`[RAG] ✉️  Added latest user message: "${latest.slice(0, 100)}${latest.length > 100 ? "..." : ""}"`);

    console.log(`[RAG] 🎯 Total message sequence length: ${seq.length} messages`);
    console.log(`[RAG] 🚀 Starting LLM streaming response...`);

    // Stream the response
    const streamed = await run(agent, seq, { context: { projectId: project.id }, stream: true });
    const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });

    let totalChunks = 0;
    for await (const delta of textStream) {
      totalChunks++;
      yield String(delta);
    }

    console.log(`[RAG] ✅ RAG streaming completed - sent ${totalChunks} chunks`);
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
}

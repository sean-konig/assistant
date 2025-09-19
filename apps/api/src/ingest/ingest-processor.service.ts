import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmbeddingsService } from "../embeddings/embeddings.service";
import { OpenAiService } from "../llm/openai.service";
import * as fs from "fs/promises";
import * as path from "path";
import { PrioritizationConfig } from "../common/interfaces/prioritization.interface";
import { ExtractorResponse, ExtractorTaskInput, PrioritizerResponse, PrioritizerResult } from "../tasks/dto/task.dto";
import { IngestJobDetails } from "./dto/ingest-manual.dto";

interface ChunkData {
  text: string;
  tokens: number;
}

@Injectable()
export class IngestProcessor {
  private readonly logger = new Logger(IngestProcessor.name);
  private prioritizationConfig: PrioritizationConfig | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly llm: OpenAiService
  ) {
    this.loadPrioritizationConfig();
  }

  private async loadPrioritizationConfig(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), "config", "prioritization.json");
      const configData = await fs.readFile(configPath, "utf-8");
      this.prioritizationConfig = JSON.parse(configData);
      this.logger.log("Prioritization config loaded successfully");
    } catch (error) {
      this.logger.error("Failed to load prioritization config:", error);
    }
  }

  async processIngestItem(details: IngestJobDetails): Promise<void> {
    const { itemId } = details;
    this.logger.log(`Starting ingest processing for item ${itemId}`);

    try {
      // 1. Get the item from database
      const item = await this.prisma.item.findUnique({
        where: { id: itemId },
        include: { project: true },
      });

      if (!item) {
        this.logger.error(`Item ${itemId} not found`);
        return;
      }

      // 2. Normalize the text content
      const normalizedText = this.normalizeText(item.body || "");

      if (!normalizedText.trim()) {
        this.logger.warn(`Item ${itemId} has no text content to process`);
        return;
      }

      // 3. Chunk the text
      const chunks = this.chunkText(normalizedText);
      this.logger.log(`Created ${chunks.length} chunks for item ${itemId}`);

      // 4. Embed the chunks
      await this.embedChunks(item.userId, item.id, item.projectId, chunks);

      // 5. Run the agent graph
      await this.runAgentGraph(item.userId, item.projectId, normalizedText, itemId);

      this.logger.log(`Successfully processed item ${itemId}`);
    } catch (error) {
      this.logger.error(`Failed to process item ${itemId}:`, error);
      throw error;
    }
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n")
      .replace(/\s+/g, " ") // Collapse whitespace
      .replace(/["'"]/g, '"') // Normalize quotes
      .trim();
  }

  private chunkText(text: string): ChunkData[] {
    const CHUNK_SIZE_TOKENS = 1000;
    const CHUNK_OVERLAP_TOKENS = 200;

    // Simple token estimation: ~4 chars per token
    const estimateTokens = (str: string) => Math.ceil(str.length / 4);

    const chunks: ChunkData[] = [];
    const words = text.split(" ");

    let currentChunk = "";
    let currentTokens = 0;

    for (const word of words) {
      const wordTokens = estimateTokens(word + " ");

      if (currentTokens + wordTokens > CHUNK_SIZE_TOKENS && currentChunk) {
        // Add the current chunk
        chunks.push({
          text: currentChunk.trim(),
          tokens: currentTokens,
        });

        // Start new chunk with overlap
        const overlapWords = currentChunk.split(" ").slice(-CHUNK_OVERLAP_TOKENS / 4);
        currentChunk = overlapWords.join(" ") + " " + word;
        currentTokens = estimateTokens(currentChunk);
      } else {
        currentChunk += word + " ";
        currentTokens += wordTokens;
      }
    }

    // Add the final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        tokens: currentTokens,
      });
    }

    return chunks.length ? chunks : [{ text, tokens: estimateTokens(text) }];
  }

  private async embedChunks(
    userId: string,
    itemId: string,
    projectId: string | null,
    chunks: ChunkData[]
  ): Promise<void> {
    for (const chunk of chunks) {
      try {
        const embeddings = await this.llm.embed([chunk.text]);
        const embedding = embeddings[0];
        if (!embedding) {
          throw new Error("Failed to generate embedding");
        }
        await this.embeddings.indexVector(
          userId,
          itemId,
          embedding,
          1536, // text-embedding-3-small dimension
          projectId
        );
      } catch (error) {
        this.logger.error(`Failed to embed chunk for item ${itemId}:`, error);
        throw error;
      }
    }
  }

  private async runAgentGraph(
    userId: string,
    projectId: string | null,
    text: string,
    sourceItemId: string
  ): Promise<void> {
    try {
      // 1. Extract tasks
      const extractedTasks = await this.extractTasks(text, sourceItemId);

      if (extractedTasks.length === 0) {
        this.logger.log(`No tasks extracted from item ${sourceItemId}`);
        // Continue to summarizer even if no tasks
      } else {
        // 2. Save extracted tasks
        await this.saveTasks(userId, projectId, extractedTasks);

        // 3. Prioritize all open tasks for this project/user
        await this.prioritizeTasks(userId, projectId);
      }

      // 4. Generate/update daily digest
      await this.updateDailyDigest(userId, projectId);
    } catch (error) {
      this.logger.error("Agent graph processing failed:", error);
      throw error;
    }
  }

  private async extractTasks(text: string, sourceItemId: string): Promise<ExtractorTaskInput[]> {
    const systemPrompt = `You are Luno Assistant's back-office agent. Be concise and practical. Use markdown. If unsure, say so and propose one next step. Default the task owner to "me" unless a different person is clearly specified. Keep answers scoped to the project unless asked for cross-project view. Extract actionable items as a short checklist when relevant. Your outputs feed a higher-level personal assistant that plans Sean's day.

Goal: From the provided text, extract tasks as strict JSON using the schema. Default owner to "me" unless another owner is explicit.
Only output JSON.`;

    const userPrompt = `Extract tasks from this text:\n\n${text}`;

    try {
      const response = await this.llm.chatMarkdown(systemPrompt, userPrompt);

      if (!response) {
        return [];
      }

      // Try to parse as JSON
      const parsed: ExtractorResponse = JSON.parse(response);

      // Add source item ID to each task
      return parsed.tasks.map((task) => ({
        ...task,
        source_ingest_event_id: sourceItemId,
      }));
    } catch (error) {
      this.logger.error("Task extraction failed:", error);
      return [];
    }
  }

  private async saveTasks(userId: string, projectId: string | null, tasks: ExtractorTaskInput[]): Promise<void> {
    for (const task of tasks) {
      await this.prisma.task.create({
        data: {
          userId,
          projectId,
          title: task.title,
          description: task.description,
          owner: task.owner || "me",
          dueDate: task.due_date ? new Date(task.due_date) : null,
          status: "todo",
          signals: task.signals || [],
          sourceItemId: task.source_ingest_event_id,
        },
      });
    }
    this.logger.log(`Saved ${tasks.length} tasks`);
  }

  async prioritizeTasks(userId: string, projectId: string | null): Promise<void> {
    if (!this.prioritizationConfig) {
      this.logger.warn("No prioritization config loaded, skipping task prioritization");
      return;
    }

    // Get all open tasks for this user/project
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        projectId,
        status: { not: "done" },
      },
    });

    if (tasks.length === 0) {
      return;
    }

    // Prepare tasks for prioritization
    const taskInputs = tasks.map((task) => ({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.toISOString(),
      signals: task.signals,
    }));

    const systemPrompt = `You are Luno Assistant's back-office agent. Be concise and practical. Use markdown. If unsure, say so and propose one next step. Default the task owner to "me" unless a different person is clearly specified. Keep answers scoped to the project unless asked for cross-project view. Extract actionable items as a short checklist when relevant. Your outputs feed a higher-level personal assistant that plans Sean's day.

Goal: Score each task 0–100 using the weights provided in the scoring matrix. Return strict JSON matching the schema. Include a short human explanation.
Buckets: P0 >= ${this.prioritizationConfig.bucket_thresholds.P0}, P1 ${this.prioritizationConfig.bucket_thresholds.P1}–${this.prioritizationConfig.bucket_thresholds.P0 - 1}, P2 ${this.prioritizationConfig.bucket_thresholds.P2}–${this.prioritizationConfig.bucket_thresholds.P1 - 1}, P3 < ${this.prioritizationConfig.bucket_thresholds.P2}.
Only output JSON.

Scoring Matrix:
${JSON.stringify(this.prioritizationConfig, null, 2)}`;

    const userPrompt = `Score and bucket these tasks:\n\n${JSON.stringify(taskInputs, null, 2)}`;

    try {
      const response = await this.llm.chatMarkdown(systemPrompt, userPrompt);

      if (!response) {
        this.logger.warn("No prioritization response received");
        return;
      }

      const parsed: PrioritizerResponse = JSON.parse(response);

      // Update tasks with prioritization results
      for (let i = 0; i < tasks.length && i < parsed.results.length; i++) {
        const task = tasks[i];
        const result = parsed.results[i];

        if (!task || !result) continue;

        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            priorityScore: result.priority_score,
            priorityBucket: result.priority_bucket,
            reason: { explanation: result.explanation },
            updatedAt: new Date(),
          },
        });
      }

      this.logger.log(`Updated priority scores for ${parsed.results.length} tasks`);
    } catch (error) {
      this.logger.error("Task prioritization failed:", error);
    }
  }

  private async updateDailyDigest(userId: string, projectId: string | null): Promise<void> {
    if (!projectId) {
      this.logger.warn("Cannot update daily digest without projectId");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get recent items and tasks for the digest
    const recentItems = await this.prisma.item.findMany({
      where: {
        userId,
        projectId,
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Last 48 hours
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const openTasks = await this.prisma.task.findMany({
      where: {
        userId,
        projectId,
        status: { not: "done" },
      },
      orderBy: { priorityScore: "desc" },
      take: 10,
    });

    const projectCode = projectId
      ? (await this.prisma.project.findUnique({ where: { id: projectId } }))?.slug || "unknown"
      : "global";

    const systemPrompt = `You are Luno Assistant's back-office agent. Be concise and practical. Use markdown. If unsure, say so and propose one next step. Default the task owner to "me" unless a different person is clearly specified. Keep answers scoped to the project unless asked for cross-project view. Extract actionable items as a short checklist when relevant. Your outputs feed a higher-level personal assistant that plans Sean's day.

Goal: Write a daily digest for ${projectCode} in markdown with sections: Top Priorities, Projects at Risk, Key Meetings, Progress Summary. Keep bullets crisp; include dates when known. If there is no data for a section, omit the section.
Output: plain markdown.`;

    const userPrompt = `Generate daily digest for ${projectCode}:

Recent Items (${recentItems.length}):
${recentItems.map((item) => `- ${item.title || "Untitled"}: ${item.body?.substring(0, 100)}...`).join("\n")}

Open Tasks (${openTasks.length}):
${openTasks.map((task) => `- [${task.priorityBucket || "P?"}] ${task.title} (Score: ${task.priorityScore || "N/A"})`).join("\n")}`;

    try {
      const response = await this.llm.chatMarkdown(systemPrompt, userPrompt);

      const summaryMd = response || "No digest generated";

      // Upsert daily digest
      await this.prisma.dailyDigest.upsert({
        where: {
          userId_projectId_forDate: {
            userId,
            projectId,
            forDate: today,
          },
        },
        update: {
          summaryMd,
        },
        create: {
          userId,
          projectId,
          forDate: today,
          summaryMd,
        },
      });

      this.logger.log(`Updated daily digest for ${projectCode}`);
    } catch (error) {
      this.logger.error("Daily digest generation failed:", error);
    }
  }
}

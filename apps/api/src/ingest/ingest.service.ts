import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JobsService } from "../jobs/jobs.service";
import { IngestManualDto, IngestManualResponseDto } from "./dto/ingest-manual.dto";
import { ItemType } from "@prisma/client";

@Injectable()
export class IngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService
  ) {}

  async ingestManual(userId: string, dto: IngestManualDto): Promise<IngestManualResponseDto> {
    // Find or get project if projectCode is provided
    let projectId: string | null = null;
    if (dto.projectCode) {
      const project = await this.prisma.project.findFirst({
        where: {
          userId,
          slug: dto.projectCode,
        },
      });
      projectId = project?.id || null;
    }

    // Map kind to ItemType
    const itemType = this.mapKindToItemType(dto.kind);

    // Create the item
    const item = await this.prisma.item.create({
      data: {
        userId,
        projectId,
        type: itemType,
        title: dto.title || this.generateTitleFromKind(dto.kind),
        body: dto.raw_text,
        raw: {
          kind: dto.kind,
          originalText: dto.raw_text,
          tags: dto.tags || [],
        },
        occurredAt: dto.occurred_at ? new Date(dto.occurred_at) : new Date(),
      },
    });

    // Enqueue background processing job
    await this.jobs.queue(userId, "ingest", { itemId: item.id });

    return { itemId: item.id };
  }

  private mapKindToItemType(kind: "note" | "meeting" | "action_items"): ItemType {
    switch (kind) {
      case "meeting":
        return ItemType.CAL_EVENT;
      case "note":
      case "action_items":
      default:
        return ItemType.NOTE;
    }
  }

  private generateTitleFromKind(kind: "note" | "meeting" | "action_items"): string {
    const now = new Date().toISOString().split("T")[0];
    switch (kind) {
      case "meeting":
        return `Meeting - ${now}`;
      case "action_items":
        return `Action Items - ${now}`;
      case "note":
      default:
        return `Note - ${now}`;
    }
  }
}

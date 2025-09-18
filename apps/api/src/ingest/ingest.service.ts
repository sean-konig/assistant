import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IngestManualDto, IngestManualResponseDto } from "./dto/ingest-manual.dto";
import { ItemType, Prisma } from "@prisma/client";
import { JobsService } from "../jobs/jobs.service";

@Injectable()
export class IngestService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobsService) private readonly jobs: JobsService
  ) {}

  async ingestManual(dto: IngestManualDto): Promise<IngestManualResponseDto> {
    if (!dto.projectId) {
      throw new BadRequestException("projectId is required");
    }

    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    const userId = project.userId;

    const itemType = this.mapKindToItemType(dto.kind);

    const item = await this.prisma.item.create({
      data: {
        userId,
        projectId: project.id,
        type: itemType,
        title: dto.title ?? null,
        body: dto.body ?? null,
        raw: (dto.raw as Prisma.InputJsonValue) ?? undefined,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });

    // Enqueue non-blocking index job
    this.jobs
      .queue(userId, "index-item", { itemId: item.id, projectId: project.id })
      .catch((err) => console.error("Failed to queue index job", err));

    return { id: item.id };
  }

  private mapKindToItemType(kind: "NOTE" | "TASK" | "DOC"): ItemType {
    switch (kind) {
      case "TASK":
        return ItemType.TASK;
      case "DOC":
        return ItemType.DOC;
      case "NOTE":
      default:
        return ItemType.NOTE;
    }
  }
}

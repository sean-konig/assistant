import { describe, it, expect, beforeEach, vi } from "vitest";
import { IngestService } from "../ingest.service";
import { PrismaService } from "../../prisma/prisma.service";
import { IngestProcessor } from "../ingest-processor.service";

describe("IngestService", () => {
  let service: IngestService;
  let prisma: PrismaService;
  let ingestProcessor: IngestProcessor;

  beforeEach(() => {
    // Mock PrismaService
    prisma = {
      item: {
        create: vi.fn(),
      },
      project: {
        findFirst: vi.fn(),
      },
    } as any;

    // Mock IngestProcessor
    ingestProcessor = {
      processIngestItem: vi.fn(),
    } as any;

    service = new IngestService(prisma, ingestProcessor);
  });

  describe("ingestManual", () => {
    it("should create an item and process it", async () => {
      const userId = "user123";
      const dto = {
        kind: "note" as const,
        title: "Test Note",
        raw_text: "This is a test note with some content.",
        occurred_at: "2025-09-17T10:00:00Z",
        tags: ["test", "note"],
      };

      const mockItem = { id: "item123", type: "NOTE" };

      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      ingestProcessor.processIngestItem = vi.fn().mockResolvedValue(undefined);

      const result = await service.ingestManual(userId, dto);

      expect(result).toEqual({ itemId: "item123" });

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          userId,
          projectId: null,
          type: "NOTE",
          title: "Test Note",
          body: "This is a test note with some content.",
          raw: {
            kind: "note",
            originalText: "This is a test note with some content.",
            tags: ["test", "note"],
          },
          occurredAt: new Date("2025-09-17T10:00:00Z"),
        },
      });

      expect(ingestProcessor.processIngestItem).toHaveBeenCalledWith({
        itemId: "item123",
        userId,
        projectId: null,
        text: dto.raw_text,
      });
    });

    it("should handle project code mapping", async () => {
      const userId = "user456";
      const dto = {
        projectCode: "test-project",
        kind: "meeting" as const,
        raw_text: "Meeting notes about the project.",
      };

      const mockProject = { id: "project123" };
      const mockItem = { id: "item456", type: "CAL_EVENT" };

      prisma.project.findFirst = vi.fn().mockResolvedValue(mockProject);
      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      ingestProcessor.processIngestItem = vi.fn().mockResolvedValue(undefined);

      const result = await service.ingestManual(userId, dto);

      expect(result).toEqual({ itemId: "item456" });

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          slug: "test-project",
        },
      });

      expect(ingestProcessor.processIngestItem).toHaveBeenCalledWith({
        itemId: "item456",
        userId,
        projectId: "project123",
        text: dto.raw_text,
      });
    });

    it("should handle processing errors gracefully", async () => {
      const userId = "user789";
      const dto = {
        kind: "action_items" as const,
        raw_text: "Task 1: Complete project. Task 2: Review documentation.",
      };

      const mockItem = { id: "item789", type: "NOTE" };

      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      ingestProcessor.processIngestItem = vi.fn().mockRejectedValue(new Error("Processing failed"));

      // Should not throw even if processing fails
      const result = await service.ingestManual(userId, dto);

      expect(result).toEqual({ itemId: "item789" });
      expect(ingestProcessor.processIngestItem).toHaveBeenCalled();
    });
  });
});

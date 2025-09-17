import { describe, it, expect, beforeEach, vi } from "vitest";
import { IngestService } from "../ingest.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JobsService } from "../../jobs/jobs.service";

describe("IngestService", () => {
  let service: IngestService;
  let prisma: PrismaService;
  let jobsService: JobsService;

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

    // Mock JobsService
    jobsService = {
      queue: vi.fn(),
    } as any;

    service = new IngestService(prisma, jobsService);
  });

  describe("ingestManual", () => {
    it("should create an item and queue a job", async () => {
      const userId = "user123";
      const dto = {
        kind: "note" as const,
        title: "Test Note",
        raw_text: "This is a test note with some content.",
        occurred_at: "2025-09-17T10:00:00Z",
        tags: ["test", "note"],
      };

      const mockItem = {
        id: "item123",
        title: "Test Note",
        type: "NOTE",
      };

      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      jobsService.queue = vi.fn().mockResolvedValue({ id: "job123" });

      const result = await service.ingestManual(userId, dto);

      expect(result.itemId).toBe("item123");
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
      expect(jobsService.queue).toHaveBeenCalledWith(userId, "ingest", { itemId: "item123" });
    });

    it("should handle project lookup when projectCode is provided", async () => {
      const userId = "user123";
      const dto = {
        projectCode: "TEST_PROJECT",
        kind: "meeting" as const,
        raw_text: "Meeting notes about the project.",
      };

      const mockProject = { id: "project123" };
      const mockItem = { id: "item456", type: "CAL_EVENT" };

      prisma.project.findFirst = vi.fn().mockResolvedValue(mockProject);
      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      jobsService.queue = vi.fn().mockResolvedValue({ id: "job456" });

      const result = await service.ingestManual(userId, dto);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { userId, slug: "TEST_PROJECT" },
      });
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          userId,
          projectId: "project123",
          type: "CAL_EVENT",
          title: expect.stringMatching(/^Meeting - \d{4}-\d{2}-\d{2}$/),
          body: "Meeting notes about the project.",
          raw: {
            kind: "meeting",
            originalText: "Meeting notes about the project.",
            tags: [],
          },
          occurredAt: expect.any(Date),
        },
      });
      expect(result.itemId).toBe("item456");
    });

    it("should handle project lookup when projectCode is provided", async () => {
      const userId = "user123";
      const dto = {
        projectCode: "TEST_PROJECT",
        kind: "meeting" as const,
        raw_text: "Meeting notes about the project.",
      };

      const mockProject = { id: "project123" };
      const mockItem = { id: "item456", type: "CAL_EVENT" };

      prisma.project.findFirst = vi.fn().mockResolvedValue(mockProject);
      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      jobsService.queue = vi.fn().mockResolvedValue({ id: "job456" });

      const result = await service.ingestManual(userId, dto);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { userId, slug: "TEST_PROJECT" },
      });
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          userId,
          projectId: "project123",
          type: "CAL_EVENT",
          title: expect.stringMatching(/^Meeting - \d{4}-\d{2}-\d{2}$/),
          body: "Meeting notes about the project.",
          raw: {
            kind: "meeting",
            originalText: "Meeting notes about the project.",
            tags: [],
          },
          occurredAt: expect.any(Date),
        },
      });
      expect(result.itemId).toBe("item456");
    });

    it("should handle non-existent project gracefully", async () => {
      const userId = "user123";
      const dto = {
        projectCode: "NONEXISTENT",
        kind: "note" as const,
        raw_text: "Some content.",
      };

      const mockItem = { id: "item789", type: "NOTE" };

      prisma.project.findFirst = vi.fn().mockResolvedValue(null);
      prisma.item.create = vi.fn().mockResolvedValue(mockItem);
      jobsService.queue = vi.fn().mockResolvedValue({ id: "job789" });

      const result = await service.ingestManual(userId, dto);

      expect(prisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: null, // Should be null when project not found
          type: "NOTE",
          body: "Some content.",
          raw: {
            kind: "note",
            originalText: "Some content.",
            tags: [],
          },
        }),
      });
      expect(jobsService.queue).toHaveBeenCalledWith(userId, "ingest", { itemId: "item789" });
      expect(result.itemId).toBe("item789");
    });
  });
});

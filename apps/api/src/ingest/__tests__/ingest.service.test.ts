import { describe, it, expect, beforeEach, vi } from "vitest";
import { IngestService } from "../ingest.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JobsService } from "../../jobs/jobs.service";
import { IndexQueueService } from "../../indexer/indexer.queue";

describe("IngestService", () => {
  let service: IngestService;
  let prisma: PrismaService;
  let jobs: JobsService;
  let indexQueue: IndexQueueService;

  beforeEach(() => {
    prisma = {
      item: {
        create: vi.fn(),
      },
      project: {
        findUnique: vi.fn(),
      },
    } as any;

    jobs = {
      queue: vi.fn().mockResolvedValue({ id: "job1" }),
    } as any;

    indexQueue = {
      enqueue: vi.fn(),
    } as any;

    service = new IngestService(prisma, jobs, indexQueue);
  });

  describe("ingestManual", () => {
    it("creates item, derives userId from project, and queues job", async () => {
      const dto = {
        projectId: "project123",
        kind: "NOTE" as const,
        title: "Test Note",
        body: "This is a test note.",
        raw: { markdown: "# Title\ntext" },
        occurredAt: "2025-09-17T10:00:00Z",
      };

      ;(prisma.project.findUnique as any) = vi.fn().mockResolvedValue({ id: "project123", userId: "user123" });
      ;(prisma.item.create as any) = vi.fn().mockResolvedValue({ id: "item123" });

      const result = await service.ingestManual(dto as any);

      expect(result).toEqual({ id: "item123" });
      expect(prisma.item.create).toHaveBeenCalledWith({
        data: {
          userId: "user123",
          projectId: "project123",
          type: "NOTE",
          title: "Test Note",
          body: "This is a test note.",
          raw: { markdown: "# Title\ntext" },
          occurredAt: new Date("2025-09-17T10:00:00Z"),
        },
      });
      expect(jobs.queue).toHaveBeenCalledWith("user123", "index-item", { itemId: "item123", projectId: "project123" });
      expect(indexQueue.enqueue).toHaveBeenCalledWith("item123");
    });

    it("maps kind to ItemType correctly", async () => {
      ;(prisma.project.findUnique as any) = vi.fn().mockResolvedValue({ id: "p1", userId: "u1" });
      ;(prisma.item.create as any) = vi.fn().mockResolvedValue({ id: "i1" });

      await service.ingestManual({ projectId: "p1", kind: "TASK" } as any);
      expect(prisma.item.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "TASK" }) }));

      await service.ingestManual({ projectId: "p1", kind: "DOC" } as any);
      expect(prisma.item.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "DOC" }) }));
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectChatService } from "../../projects/project-chat.service";

function makePrismaMock() {
  return {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  } as any;
}

describe("ProjectChatService", () => {
  let prisma: any;
  let svc: ProjectChatService;

  beforeEach(() => {
    prisma = makePrismaMock();
    const mockEmbeddingPipeline = {} as any; // Mock the embedding pipeline
    svc = new ProjectChatService(prisma, mockEmbeddingPipeline);
  });

  it("appendMessage inserts a CHAT row", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: "cid" }]);
    prisma.$executeRawUnsafe.mockResolvedValueOnce(1);
    await svc.appendMessage("u1", "p1", { role: "user", content: "hi" });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });
});

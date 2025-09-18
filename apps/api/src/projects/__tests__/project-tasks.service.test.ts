import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectTasksService } from '../../projects/project-tasks.service';

function makePrismaMock() {
  return {
    $queryRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  } as any;
}

describe('ProjectTasksService', () => {
  let prisma: any;
  let embeddingPipeline: any;
  let svc: ProjectTasksService;

  beforeEach(() => {
    prisma = makePrismaMock();
    embeddingPipeline = {
      generateAndIndex: vi.fn().mockResolvedValue(undefined),
    };
    svc = new ProjectTasksService(prisma, embeddingPipeline);
  });

  it('create inserts TASK row', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'tid' }]);
    prisma.$executeRawUnsafe.mockResolvedValueOnce(1);
    const res = await svc.create('u1', 'p1', { title: 'T', status: 'OPEN', priority: 1 });
    expect(res.id).toBe('tid');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });
});

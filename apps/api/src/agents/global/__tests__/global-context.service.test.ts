import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalContextService } from '../global-context.service';

function makeVector(value: number): number[] {
  return Array.from({ length: 1536 }, () => value);
}

describe('GlobalContextService', () => {
  let prisma: any;
  let embeddings: any;
  let service: GlobalContextService;

  beforeEach(() => {
    prisma = {
      $queryRawUnsafe: vi.fn(),
      task: { findMany: vi.fn() },
      item: { findMany: vi.fn() },
      riskScore: { findMany: vi.fn() },
    };
    embeddings = { embed: vi.fn() };
    service = new GlobalContextService(prisma, embeddings);
  });

  it('filters snippets by distance threshold', async () => {
    embeddings.embed.mockResolvedValue([makeVector(0.01)]);
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'a', type: 'NOTE', title: 'Keep', body: 'body', raw: null, distance: 0.4, projectId: 'p1' },
      { id: 'b', type: 'NOTE', title: 'Drop', body: 'body', raw: null, distance: 0.8, projectId: 'p1' },
    ]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.item.findMany.mockResolvedValue([]);
    prisma.riskScore.findMany.mockResolvedValue([]);

    const result = await service.fetch('user-1', { query: 'status update' });
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]?.itemId).toBe('a');
    expect(result.references).toHaveLength(1);
  });

  it('omits completed tasks from task list', async () => {
    embeddings.embed.mockResolvedValue([makeVector(0.02)]);
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    const taskRows = [
      {
        id: 't-open',
        title: 'Active task',
        status: 'todo',
        dueDate: new Date('2025-01-02'),
        projectId: 'proj-1',
        project: { slug: 'proj-1' },
      },
      {
        id: 't-done',
        title: 'Finished task',
        status: 'done',
        dueDate: null,
        projectId: null,
        project: { slug: null },
      },
    ];
    prisma.task.findMany.mockImplementation(async (args: any) => {
      const forbiddenStatus = args?.where?.status?.not;
      return forbiddenStatus
        ? taskRows.filter((row) => row.status !== forbiddenStatus)
        : taskRows;
    });
    prisma.item.findMany.mockResolvedValue([]);
    prisma.riskScore.findMany.mockResolvedValue([]);

    const result = await service.fetch('user-1', { query: 'tasks' });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({ id: 't-open', title: 'Active task', status: 'todo' });
  });
});

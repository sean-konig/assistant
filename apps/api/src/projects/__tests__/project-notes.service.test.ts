import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectNotesService } from '../../projects/project-notes.service';

function makePrismaMock() {
  return {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  } as any;
}

describe('ProjectNotesService', () => {
  const FIXED = new Date('2025-01-01T00:00:00Z');
  let prisma: any;
  let svc: ProjectNotesService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED);
    prisma = makePrismaMock();
    svc = new ProjectNotesService(prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getLatestNoteId returns id for latest NOTE', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'abc', raw: { kind: 'NOTE' } }]);
    const id = await svc.getLatestNoteId('p1');
    expect(id).toBe('abc');
  });

  it('create inserts NOTE row and returns typed note', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'uuid-1' }]);
    prisma.$executeRawUnsafe.mockResolvedValueOnce(1);
    const result = await svc.create('u1', 'p1', {
      markdown: '# Title',
      summaryMarkdown: null,
      tags: ['risk'],
      authorEmail: 'x@y.com',
      noteType: 'GENERAL',
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('uuid-1');
    expect(result.content).toBe('# Title');
  });
});


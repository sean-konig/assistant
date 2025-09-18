import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectDetailsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProjectDetails(projectId: string) {
    const items: any[] = await this.prisma.$queryRawUnsafe(
      'SELECT id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt" FROM items WHERE "projectId" = $1 ORDER BY "createdAt" DESC',
      projectId,
    );
    const notes = items
      .filter((i) => i.type === 'NOTE' && (i as any).raw?.kind !== 'TASK' && (i as any).raw?.kind !== 'CHAT')
      .map((i) => ({
        id: i.id,
        projectCode: undefined,
        meetingId: undefined,
        authorEmail: (i as any).raw?.authorEmail ?? undefined,
        content: (i as any).raw?.markdown ?? i.body ?? i.title ?? '',
        summaryMarkdown: (i as any).raw?.summaryMarkdown ?? undefined,
        tags: ((i as any).raw?.tags ?? []) as string[],
        createdAt: i.createdAt.toISOString(),
      }));
    const tasks = items
      .filter((i) => (i as any).raw?.kind === 'TASK')
      .map((i) => {
        const rawStatus = ((i as any).raw?.status ?? 'OPEN') as 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
        const status = rawStatus === 'DONE' ? 'done' : rawStatus === 'IN_PROGRESS' || rawStatus === 'BLOCKED' ? 'in_progress' : 'todo';
        return {
          id: i.id,
          projectCode: undefined,
          title: i.title ?? i.body ?? '',
          status,
          dueDate: (i as any).raw?.dueDate ?? null,
          priority: Number((i as any).raw?.priority ?? 0),
          source: ((i as any).raw?.source ?? 'MANUAL') as 'MANUAL' | 'EMAIL' | 'MEETING',
          updatedAt: i.updatedAt.toISOString(),
        };
      });
    const meetings: any[] = [];
    const chat = items
      .filter((i) => (i as any).raw?.kind === 'CHAT')
      .map((i) => ({ id: i.id, role: (i as any).raw?.role ?? 'assistant', content: i.body ?? '', createdAt: i.createdAt.toISOString() }))
      .reverse();
    return { notes, tasks, meetings, chat };
  }
}

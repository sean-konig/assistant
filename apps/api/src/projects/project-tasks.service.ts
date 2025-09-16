import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectTasksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    projectId: string,
    payload: { title: string; status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; priority: number; dueDate?: string | null; source?: 'MANUAL' | 'EMAIL' | 'MEETING' },
  ) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      'NOTE',
      payload.title,
      null,
      { kind: 'TASK', status: payload.status, priority: payload.priority, dueDate: payload.dueDate ?? null, source: payload.source ?? 'MANUAL' },
      null,
      now,
    );
    const created = { id, updatedAt: now } as any;
    return {
      id: created.id,
      projectCode: undefined,
      title: payload.title,
      status: payload.status,
      dueDate: payload.dueDate ?? null,
      priority: payload.priority,
      source: payload.source ?? 'MANUAL',
      updatedAt: created.updatedAt.toISOString(),
    } as const;
  }
}


import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectChatService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async appendMessage(userId: string, projectId: string, msg: { role: 'user' | 'assistant'; content: string }) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    const now = new Date();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      id,
      userId,
      projectId,
      'NOTE',
      null,
      msg.content,
      { kind: 'CHAT', role: msg.role },
      null,
      now,
    );
  }

  async getRecent(projectId: string, limit = 10): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const rows = (await this.prisma.$queryRawUnsafe(
      'SELECT body, raw, "createdAt" FROM items WHERE "projectId" = $1 AND raw->>\'kind\' = $2 ORDER BY "createdAt" DESC LIMIT $3',
      projectId,
      'CHAT',
      limit,
    )) as any[];
    const turns = rows.map((r) => ({ role: (r.raw?.role ?? 'assistant') as 'user' | 'assistant', content: r.body ?? '' }));
    return turns.reverse();
  }
}


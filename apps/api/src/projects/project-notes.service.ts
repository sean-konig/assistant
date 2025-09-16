import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectNotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getLatestNoteId(projectId: string): Promise<string | null> {
    const row = (await this.prisma.$queryRawUnsafe(
      'SELECT id, raw FROM items WHERE "projectId" = $1 AND type = $2 ORDER BY "createdAt" DESC LIMIT 1',
      projectId,
      'NOTE',
    )) as any[];
    if (!row[0]) return null;
    if (row[0].raw?.kind === 'NOTE') return row[0].id as string;
    return null;
  }

  async create(
    userId: string,
    projectId: string,
    data: { markdown: string; summaryMarkdown: string | null; tags: string[]; authorEmail: string | null; noteType: string },
  ) {
    const plain = this.stripMarkdown(data.markdown).slice(0, 10_000);
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
      plain,
      { kind: 'NOTE', markdown: data.markdown, summaryMarkdown: data.summaryMarkdown, tags: data.tags, authorEmail: data.authorEmail, noteType: data.noteType },
      null,
      now,
    );
    const created = { id, createdAt: now, updatedAt: now } as any;
    return {
      id: created.id,
      projectCode: undefined,
      meetingId: undefined,
      authorEmail: data.authorEmail ?? undefined,
      content: data.markdown,
      summaryMarkdown: data.summaryMarkdown ?? undefined,
      tags: data.tags,
      createdAt: created.createdAt.toISOString(),
    } as const;
  }

  private stripMarkdown(md: string): string {
    return md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
      .replace(/\[[^\]]*\]\([^\)]*\)/g, (m) => m.replace(/\[[^\]]*\]\([^\)]*\)/g, ''))
      .replace(/^#+\s+/gm, '')
      .replace(/^>+\s?/gm, '')
      .replace(/[*_~`>#-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}


import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, data: any) {
    return this.prisma.item.create({ data: { ...data, userId } })
  }

  list(userId: string, filters: { projectId?: string; type?: string; q?: string }) {
    const where: any = { userId }
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.type) where.type = filters.type
    if (filters.q) where.OR = [{ title: { contains: filters.q, mode: 'insensitive' } }, { body: { contains: filters.q, mode: 'insensitive' } }]
    return this.prisma.item.findMany({ where, orderBy: { createdAt: 'desc' } })
  }

  // Helpers to consolidate raw SQL inserts/queries for items
  async genId(): Promise<string> {
    const row = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`
    return row[0]?.id ?? String(Math.random()).slice(2)
  }

  async insertRawItem(params: {
    id?: string
    userId: string
    projectId?: string | null
    type: 'NOTE' | 'EMAIL' | 'DOC' | 'CAL_EVENT'
    title?: string | null
    body?: string | null
    raw?: any
    occurredAt?: Date | null
    createdAt?: Date
  }): Promise<{ id: string; createdAt: Date }> {
    const id = params.id ?? (await this.genId())
    const now = params.createdAt ?? new Date()
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO items (id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      id,
      params.userId,
      params.projectId ?? null,
      params.type,
      params.title ?? null,
      params.body ?? null,
      params.raw ?? null,
      params.occurredAt ?? null,
      now,
    )
    return { id, createdAt: now }
  }

  async insertChatMessage(userId: string, projectId: string, role: 'user' | 'assistant', content: string) {
    return this.insertRawItem({ userId, projectId, type: 'NOTE', title: null, body: content, raw: { kind: 'CHAT', role } })
  }

  async insertNote(userId: string, projectId: string, markdown: string, stripped: string, extra: any) {
    return this.insertRawItem({ userId, projectId, type: 'NOTE', title: null, body: stripped, raw: { kind: 'NOTE', markdown, ...extra } })
  }

  async insertTask(
    userId: string,
    projectId: string,
    payload: { title: string; status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; priority: number; dueDate?: string | null; source?: 'MANUAL' | 'EMAIL' | 'MEETING' },
  ) {
    return this.insertRawItem({
      userId,
      projectId,
      type: 'NOTE',
      title: payload.title,
      body: null,
      raw: { kind: 'TASK', status: payload.status, priority: payload.priority, dueDate: payload.dueDate ?? null, source: payload.source ?? 'MANUAL' },
    })
  }

  async queryProjectItems(projectId: string) {
    return this.prisma.$queryRawUnsafe(
      'SELECT id,"userId","projectId",type,title,body,raw,"occurredAt","createdAt","updatedAt" FROM items WHERE "projectId" = $1 ORDER BY "createdAt" DESC',
      projectId,
    )
  }
}

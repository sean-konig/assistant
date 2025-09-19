import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GlobalDigestPayload } from '../agents/global/global-agent.service'

@Injectable()
export class DigestsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, date = new Date()) {
    const items = await this.prisma.item.findMany({
      where: {
        userId,
        occurredAt: { lte: date },
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    })
    const lines = ['Top items:', ...items.map((i) => `- ${i.title ?? i.type}`)]
    const summary = lines.join('\n')
    return this.prisma.digest.create({ data: { userId, date, summary } })
  }

  async saveGlobalDigest(userId: string, payload: GlobalDigestPayload) {
    const isoDate = `${payload.date}T00:00:00.000Z`
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid digest date')
    }
    const summary = JSON.stringify(payload)
    const existing = await this.prisma.digest.findFirst({ where: { userId, date } })
    if (existing) {
      return this.prisma.digest.update({ where: { id: existing.id }, data: { summary, date } })
    }
    return this.prisma.digest.create({ data: { userId, date, summary } })
  }

  async getLatest(userId: string) {
    const row = await this.prisma.digest.findFirst({ where: { userId }, orderBy: { date: 'desc' } })
    if (!row) return null
    const payload = this.parsePayload(row.summary)
    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      createdAt: row.createdAt.toISOString(),
      markdown: payload?.markdown ?? row.summary,
      sections: payload?.sections ?? { overview: [], priorities: [], meetings: [], tasks: [], risks: [] },
      actions: payload?.actions ?? [],
      references: payload?.references ?? [],
      followups: payload?.followups ?? [],
      raw: payload ?? null,
    }
  }

  private parsePayload(summary: string | null): GlobalDigestPayload | null {
    if (!summary) return null
    try {
      const parsed = JSON.parse(summary)
      if (parsed && typeof parsed === 'object') {
        return parsed as GlobalDigestPayload
      }
    } catch {
      return null
    }
    return null
  }
}

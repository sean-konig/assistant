import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DigestsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, date = new Date()) {
    // Simple digest based on today’s items
    const items = await this.prisma.item.findMany({
      where: {
        userId,
        occurredAt: { lte: date },
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    })
    const summary = `Top items: \n` + items.map((i) => `- ${i.title ?? i.type}`).join('\n')
    return this.prisma.digest.create({ data: { userId, date, summary } })
  }
}


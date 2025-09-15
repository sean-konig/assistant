import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RisksService {
  constructor(private readonly prisma: PrismaService) {}

  async scoreProject(userId: string, projectId: string) {
    // Placeholder: a trivial score based on counts of items
    const items = await this.prisma.item.count({ where: { userId, projectId } })
    const score = Math.min(100, items * 5)
    const risk = await this.prisma.riskScore.create({
      data: { userId, projectId, score, factors: { items } },
    })
    return risk
  }
}


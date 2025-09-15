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
}


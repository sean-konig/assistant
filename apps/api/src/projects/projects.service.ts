import { ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: { name: string; slug: string }) {
    try {
      return await this.prisma.project.create({ data: { ...data, userId } })
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Project slug already exists')
      throw e
    }
  }

  list(userId: string) {
    return this.prisma.project.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
  }
}


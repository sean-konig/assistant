import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SourceType } from '@prisma/client'

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, data: { type: SourceType; label: string; config: any }) {
    return this.prisma.source.create({ data: { ...data, userId } })
  }
}


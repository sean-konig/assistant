import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  queue(userId: string, kind: string, details?: any) {
    return this.prisma.jobRun.create({ data: { userId, kind, status: 'queued', details } })
  }
}


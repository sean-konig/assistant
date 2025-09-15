import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dueAt: Date, content: string) {
    return this.prisma.reminder.create({ data: { userId, dueAt, content } })
  }

  list(userId: string) {
    return this.prisma.reminder.findMany({ where: { userId }, orderBy: { dueAt: 'asc' } })
  }
}


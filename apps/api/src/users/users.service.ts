import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }

  async update(userId: string, data: { name?: string | null }) {
    const exists = await this.getById(userId)
    if (!exists) throw new NotFoundException('User not found')
    return this.prisma.user.update({ where: { id: userId }, data: { name: data.name ?? undefined } })
  }
}


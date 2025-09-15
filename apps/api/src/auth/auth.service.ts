import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(user: { id: string; email: string; name?: string | null }) {
    const existing = await this.prisma.user.findUnique({ where: { id: user.id } })
    if (existing) return existing
    return this.prisma.user.create({
      data: {
        id: user.id,
        authUserId: user.id,
        email: user.email,
        name: user.name ?? undefined,
      },
    })
  }
}


import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class EmbeddingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Stores vector using raw SQL to ensure correct VECTOR type
  async indexVector(userId: string, itemId: string | null, vector: number[], dim = 1536) {
    const idRow = await this.prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`;
    const id = idRow[0]?.id ?? String(Math.random()).slice(2);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO embeddings (id, "userId", "itemId", vector, dim, "createdAt") VALUES ($1, $2, $3, $4::vector, $5, now())`,
      id,
      userId,
      itemId,
      `[${vector.join(',')}]`,
      dim,
    );
    return { id };
  }
}

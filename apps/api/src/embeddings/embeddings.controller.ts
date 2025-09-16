import { Body, Controller, Post, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseJwtGuard } from "../common/guards/supabase-jwt.guard";
import { GetUser } from "../common/decorators/get-user.decorator";
import { EmbeddingsService } from "./embeddings.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("embeddings")
@ApiBearerAuth("bearer")
@UseGuards(SupabaseJwtGuard)
@Controller("embeddings")
export class EmbeddingsController {
  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly prisma: PrismaService
  ) {}

  @Get("debug-prisma")
  debugPrisma() {
    return {
      hasPrisma: Boolean(this.prisma),
      prismaType: typeof this.prisma,
      prismaConstructor: this.prisma?.constructor?.name,
      hasQueryRawUnsafe: Boolean(this.prisma?.$queryRawUnsafe),
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.prisma || {})),
    };
  }

  @Post("index")
  index(
    @GetUser() user: { id: string },
    @Body("projectId") projectId: string | null,
    @Body("itemId") itemId: string | null,
    @Body("vector") vector: number[],
    @Body("dim") dim?: number
  ) {
    return this.embeddings.indexVector(user.id, itemId, vector, dim ?? 1536, projectId ?? undefined);
  }
}

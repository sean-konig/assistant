import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { EmbeddingsService } from './embeddings.service'

@ApiTags('embeddings')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddings: EmbeddingsService) {}

  @Post('index')
  index(
    @GetUser() user: { id: string },
    @Body('itemId') itemId: string | null,
    @Body('vector') vector: number[],
    @Body('dim') dim?: number,
  ) {
    return this.embeddings.indexVector(user.id, itemId, vector, dim ?? 768)
  }
}


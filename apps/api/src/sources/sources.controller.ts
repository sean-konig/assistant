import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { SourcesService } from './sources.service'
import { UpsertSourceDto, SourceTypeDto } from './dto/upsert-source.dto'

@ApiTags('sources')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Post()
  upsert(@GetUser() user: { id: string }, @Body() dto: UpsertSourceDto) {
    return this.sources.upsert(user.id, {
      type: dto.type as any,
      label: dto.label,
      config: dto.config,
    })
  }
}


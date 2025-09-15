import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { RisksService } from './risks.service'

@ApiTags('risks')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('risks')
export class RisksController {
  constructor(private readonly risks: RisksService) {}

  @Post('score')
  score(@GetUser() user: { id: string }, @Body('projectId') projectId: string) {
    return this.risks.scoreProject(user.id, projectId)
  }
}


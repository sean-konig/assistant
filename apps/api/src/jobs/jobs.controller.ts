import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { JobsService } from './jobs.service'

@ApiTags('jobs')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('queue')
  queue(@GetUser() user: { id: string }, @Body('kind') kind: string, @Body('details') details?: any) {
    return this.jobs.queue(user.id, kind, details)
  }
}


import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'

@ApiTags('projects')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@GetUser() user: { id: string }, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto)
  }

  @Get()
  list(@GetUser() user: { id: string }) {
    return this.projects.list(user.id)
  }
}


import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { ItemsService } from './items.service'
import { CreateItemDto } from './dto/create-item.dto'

@ApiTags('items')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Post()
  create(@GetUser() user: { id: string }, @Body() dto: CreateItemDto) {
    return this.items.create(user.id, dto)
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'q', required: false })
  list(
    @GetUser() user: { id: string },
    @Query('projectId') projectId?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
  ) {
    return this.items.list(user.id, { projectId, type, q })
  }
}


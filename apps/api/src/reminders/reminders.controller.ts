import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { RemindersService } from './reminders.service'

@ApiTags('reminders')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post()
  create(@GetUser() user: { id: string }, @Body('dueAt') dueAt: string, @Body('content') content: string) {
    return this.reminders.create(user.id, new Date(dueAt), content)
  }

  @Get()
  list(@GetUser() user: { id: string }) {
    return this.reminders.list(user.id)
  }
}


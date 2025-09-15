import { Body, Controller, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard'
import { GetUser } from '../common/decorators/get-user.decorator'
import { UsersService } from './users.service'
import { UpdateUserDto } from './dto/update-user.dto'

@ApiTags('users')
@ApiBearerAuth('bearer')
@UseGuards(SupabaseJwtGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  updateMe(@GetUser() user: { id: string }, @Body() dto: UpdateUserDto) {
    return this.users.update(user.id, dto)
  }
}


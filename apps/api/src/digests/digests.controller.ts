import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseJwtGuard } from "../common/guards/supabase-jwt.guard";
import { GetUser } from "../common/decorators/get-user.decorator";
import { DigestsService } from "./digests.service";

@ApiTags("digests")
// @ApiBearerAuth('bearer')
// @UseGuards(SupabaseJwtGuard)
@Controller("digests")
export class DigestsController {
  constructor(private readonly digests: DigestsService) {}

  @Post("generate")
  generate(@GetUser() user: { id: string }, @Body("date") date?: string) {
    return this.digests.generate(user.id, date ? new Date(date) : new Date());
  }
}

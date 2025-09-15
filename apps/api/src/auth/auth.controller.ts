import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SupabaseJwtGuard } from "../common/guards/supabase-jwt.guard";
import { GetUser, type RequestUser } from "../common/decorators/get-user.decorator";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@ApiBearerAuth("bearer")
@UseGuards(SupabaseJwtGuard)
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  async me(@GetUser() user: RequestUser) {
    const profile = await this.auth.ensureProfile(user);
    return { id: profile.id, email: profile.email, name: profile.name, role: profile.role };
  }
}

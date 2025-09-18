import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SupabaseJwtStrategy } from "./strategies/supabase-jwt.strategy";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

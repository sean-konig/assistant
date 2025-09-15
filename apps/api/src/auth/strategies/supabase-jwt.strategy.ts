import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'

@Injectable()
export class SupabaseJwtStrategy {
  private jwks?: ReturnType<typeof createRemoteJWKSet>
  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<JWTPayload> {
    const jwksUrl = new URL(this.config.get<string>('app.supabase.jwksUrl')!)
    this.jwks ||= createRemoteJWKSet(jwksUrl)
    const { payload } = await jwtVerify(token, this.jwks)
    return payload
  }
}


import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JWTPayload } from 'jose'
import { SupabaseJwtStrategy } from '../../auth/strategies/supabase-jwt.strategy'

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  constructor(private readonly strategy: SupabaseJwtStrategy) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const auth = req.headers['authorization'] as string | undefined
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token')
    const token = auth.slice('Bearer '.length)

    try {
      const payload = await this.strategy.verify(token)
      const user = this.mapPayloadToUser(payload)
      if (!user?.id || !user?.email) throw new Error('Invalid JWT payload')
      req.user = user
      return true
    } catch (e) {
      throw new UnauthorizedException('Invalid token')
    }
  }

  private mapPayloadToUser(payload: JWTPayload) {
    // Supabase user claims
    // sub: UUID, email, user_metadata.name, role
    const id = String(payload.sub || '')
    const email = String((payload as any).email || '')
    const name = (payload as any).user_metadata?.name ?? (payload as any).name ?? null
    const role = (payload as any).role ?? (payload as any).app_metadata?.role ?? 'USER'
    return { id, authUserId: id, email, name, role }
  }
}

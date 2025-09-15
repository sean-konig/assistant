import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface RequestUser {
  id: string
  authUserId: string
  email: string
  name?: string | null
  role?: string
}

export const GetUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest()
  return req.user as RequestUser
})


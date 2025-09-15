import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Observable, tap } from 'rxjs'

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const id = req.headers['x-request-id'] || randomUUID()
    req.id = id
    const start = Date.now()
    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse()
        // eslint-disable-next-line no-console
        console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms id=${id}`)
      }),
    )
  }
}


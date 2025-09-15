import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const status = exception.getStatus()
    const res: any = exception.getResponse()
    response.status(status).send({
      statusCode: status,
      message: res?.message || exception.message,
      error: res?.error || undefined,
    })
  }
}


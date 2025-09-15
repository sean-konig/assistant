import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { RequestLoggerInterceptor } from "./common/interceptors/request-logger.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const config = app.get(ConfigService);

  await app.register(helmet);
  await app.register(cors, { origin: true, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  const swaggerEnabled = config.get<boolean>("app.swaggerEnabled");
  const nodeEnv = config.get<string>("app.nodeEnv") ?? "development";
  if (swaggerEnabled && nodeEnv !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Assistant API")
      .setDescription("Assistant backend API")
      .setVersion("1.0")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "bearer")
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("/docs", app, doc);
  }

  const port = config.get<number>("app.port") || 3002;
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
}

bootstrap();

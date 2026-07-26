import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { buildOpenapiDocument } from './openapi/openapi.document';

async function bootstrap(): Promise<void> {
  // `bufferLogs` holds startup logs until the pino logger is installed, so nothing is emitted
  // through Nest's default console logger and every line is structured.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // `whitelist` strips unknown fields; `forbidNonWhitelisted` rejects them outright; `transform`
  // turns plain payloads into DTO instances (and coerces primitives).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGIN'), credentials: true });

  // Interactive docs at `/api/docs`, built from the same document the client is generated from.
  SwaggerModule.setup('api/docs', app, buildOpenapiDocument(app));

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();

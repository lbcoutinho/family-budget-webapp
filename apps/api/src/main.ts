import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { buildOpenapiDocument } from './openapi/openapi.document';

async function bootstrap(): Promise<void> {
  // `bufferLogs` holds startup logs until the pino logger is installed, so nothing is emitted
  // through Nest's default console logger and every line is structured.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // Prefix, validation, exception mapping and cookie parsing — the same pipeline the e2e specs
  // build, so what is tested is what runs.
  configureApp(app);

  // `credentials` so the browser both sends and stores the refresh cookie on cross-origin calls
  // from the Vite dev server.
  app.enableCors({ origin: config.getOrThrow<string>('CORS_ORIGIN'), credentials: true });

  // Interactive docs at `/api/docs`, built from the same document the client is generated from.
  SwaggerModule.setup('api/docs', app, buildOpenapiDocument(app));

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';

import { buildOpenapiDocument } from './openapi.document';

/**
 * Writes `openapi.json` at the API package root without ever listening on a port or touching the
 * database. `preview: true` builds the dependency graph for metadata scanning but skips lifecycle
 * hooks, so `PrismaService.onModuleInit` never opens a connection — the export runs with no
 * database available. Boot-time env validation still runs, so the standard env vars must be set.
 */
async function exportOpenapi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });

  const document = buildOpenapiDocument(app);
  const outputPath = join(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();

  // eslint-disable-next-line no-console
  console.log(`OpenAPI document written to ${outputPath}`);
}

void exportOpenapi();

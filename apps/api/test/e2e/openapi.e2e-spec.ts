import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type OpenAPIObject } from '@nestjs/swagger';

import { AppModule } from '../../src/app.module';
import { buildOpenapiDocument } from '../../src/openapi/openapi.document';

/**
 * Guards the contract the frontend client is generated from. `preview: true` builds the module
 * graph without lifecycle hooks, so the document is produced without a database connection.
 */
describe('OpenAPI document', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { preview: true, logger: false });
    document = buildOpenapiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes the health endpoint (unprefixed path, served under the /api server)', () => {
    expect(document.paths['/health']?.get).toBeDefined();
    expect(document.servers?.map((server) => server.url)).toContain('/api');
  });

  it('gives the health operation a stable operationId so the generated hook name is stable', () => {
    expect(document.paths['/health']?.get?.operationId).toBe('getHealth');
  });

  it('registers the HealthStatusDto schema', () => {
    expect(document.components?.schemas?.HealthStatusDto).toBeDefined();
  });
});

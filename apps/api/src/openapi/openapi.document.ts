import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Builds the OpenAPI document from the running application's route metadata. Shared by two callers
 * so the served Swagger UI (`main.ts`) and the exported `openapi.json` (`openapi/export.ts`) stay
 * byte-for-byte identical.
 *
 * Paths are emitted without the global `/api` prefix (the prefix lives on the platform adapter,
 * not in route metadata). The single declared server `/api` restores it, so the generated client's
 * axios `baseURL` and the Swagger UI "Try it out" both target the real URL.
 */
export function buildOpenapiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Family Budget API')
    .setDescription('REST API for the family budget web application.')
    .setVersion('1.0.0')
    .addServer('/api')
    .build();

  return SwaggerModule.createDocument(app, config);
}

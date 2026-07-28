import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Name of the bearer security scheme. Also the key the Swagger UI's "Authorize" dialog is
 * labelled with, and what the generated client would reference if it ever wires auth itself.
 */
export const BEARER_SCHEME = 'bearer';

/**
 * Builds the OpenAPI document from the running application's route metadata. Shared by two callers
 * so the served Swagger UI (`main.ts`) and the exported `openapi.json` (`openapi/export.ts`) stay
 * byte-for-byte identical.
 *
 * Paths are emitted without the global `/api` prefix (the prefix lives on the platform adapter,
 * not in route metadata). The single declared server `/api` restores it, so the generated client's
 * axios `baseURL` and the Swagger UI "Try it out" both target the real URL.
 *
 * Security mirrors the runtime: the bearer scheme is required document-wide, exactly as
 * `JwtAuthGuard` protects every route by default, and `@Public()` lifts it per operation. So the
 * "Authorize" button in the UI works, and a route can never be documented as open while the guard
 * rejects it.
 */
export function buildOpenapiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Family Budget API')
    .setDescription('REST API for the family budget web application.')
    .setVersion('1.0.0')
    .addServer('/api')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token from `POST /auth/login`.' }, BEARER_SCHEME)
    .addSecurityRequirements(BEARER_SCHEME)
    .build();

  return SwaggerModule.createDocument(app, config);
}

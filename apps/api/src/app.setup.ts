import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

/**
 * Everything that turns a bare Nest application into *this* application: prefix, validation,
 * exception mapping, cookie parsing.
 *
 * Shared by `main.ts` and the end-to-end specs so a test exercises the same request pipeline the
 * server runs. Each piece added here (the cookie parser, for one) would otherwise have to be
 * repeated in every spec, and a spec that forgets one silently tests a different application.
 *
 * What is *not* here: CORS, the port and the Swagger UI, which depend on configuration or on the
 * process actually listening. Those stay in `main.ts`.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  // `whitelist` strips unknown fields; `forbidNonWhitelisted` rejects them outright; `transform`
  // turns plain payloads into DTO instances (and coerces primitives).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  app.useGlobalFilters(new PrismaExceptionFilter());

  // Parses the refresh cookie `POST /api/auth/refresh` reads (M2-T03). Unsigned: the cookie's
  // integrity comes from the JWT signature inside it, not from a second signing layer.
  app.use(cookieParser());
}

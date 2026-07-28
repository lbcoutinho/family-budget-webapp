import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashService } from './hash.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';

/**
 * Authentication (ADR-0011). `PassportModule` is registered without a default strategy: login
 * names `local` explicitly and the global guard names `jwt`, so nothing depends on an implicit
 * default.
 *
 * `JwtModule` is registered bare — no secret, no expiry. Access and refresh tokens are signed
 * with *different* secrets and lifetimes, both read from `ConfigService` at signing time, so a
 * module-level default would only be a footgun waiting for someone to forget an override.
 *
 * `JwtAuthGuard` is bound as an `APP_GUARD`, which Nest applies to every route in the
 * application, not only to this module's. It is declared here rather than in `AppModule` so that
 * the strategy it depends on and the guard that uses it stay in one place — a feature module that
 * knows nothing about authentication is still protected by it.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, HashService, LocalStrategy, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [AuthService, HashService],
})
export class AuthModule {}

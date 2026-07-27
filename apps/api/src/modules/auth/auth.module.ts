import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashService } from './hash.service';
import { LocalStrategy } from './local.strategy';

/**
 * Authentication (ADR-0011). `PassportModule` is registered without a default strategy: login
 * names `local` explicitly, and M2-T04's global guard will name `jwt`, so nothing depends on an
 * implicit default.
 *
 * `JwtModule` is registered bare — no secret, no expiry. Access and refresh tokens are signed
 * with *different* secrets and lifetimes, both read from `ConfigService` at signing time, so a
 * module-level default would only be a footgun waiting for someone to forget an override.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, HashService, LocalStrategy],
  exports: [AuthService, HashService],
})
export class AuthModule {}

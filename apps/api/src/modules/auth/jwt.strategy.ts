import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';

import { type JwtPayload } from './auth.service';
import { type AuthenticatedUser } from './authenticated-user';

/**
 * The `jwt` Passport strategy behind every protected route (ADR-0011). It verifies the access
 * token from the `Authorization: Bearer` header and turns its claims into `request.user`.
 *
 * Verification — signature, expiry — happens inside passport-jwt before `validate` is reached, so
 * an expired or tampered token never gets this far: the guard answers 401 on its own.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    // `JWT_SECRET`, not `REFRESH_TOKEN_SECRET`: a refresh cookie replayed as a bearer token is
    // signed with the other secret and fails here.
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    };

    super(options);
  }

  /**
   * Whatever this returns becomes `request.user`. The claims are taken at face value rather than
   * re-read from the database — see the note on `AuthenticatedUser` for why.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email };
  }
}

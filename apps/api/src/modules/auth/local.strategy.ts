import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from './auth.service';
import { AuthUserDto } from './dto/auth-user.dto';

/**
 * The `local` Passport strategy behind `POST /api/auth/login` (ADR-0011). Its only job is to run
 * the credential check and turn a failure into a 401; whatever it returns becomes `request.user`.
 *
 * `usernameField` is remapped because passport-local defaults to a `username` field and this
 * application identifies accounts by email.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email' });
  }

  /**
   * @throws UnauthorizedException with a message that is the same for a wrong password and an
   *   unknown address, so the endpoint never reveals which accounts exist.
   */
  async validate(email: string, password: string): Promise<AuthUserDto> {
    const user = await this.auth.validateUser(email, password);

    if (user === null) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}

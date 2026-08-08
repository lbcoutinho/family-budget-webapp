import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

import { PrismaService } from '../../prisma/prisma.service';

import { AuthUserDto } from './dto/auth-user.dto';
import { SessionDto } from './dto/session.dto';
import { HashService } from './hash.service';

/**
 * Claims carried by both tokens. `sub` is the JWT registered claim for the subject — the user id
 * — and `email` rides along so a request can be attributed in a log without a database read.
 */
export interface JwtPayload {
  sub: string;
  email: string;
}

/** A signed token together with the moment it stops being valid, read back from its own claims. */
interface SignedToken {
  token: string;
  expiresAt: Date;
}

/**
 * The security logic of M2, kept in one provider: which credentials are valid, and what a valid
 * pair is worth (ADR-0011). The controller only translates the result into HTTP.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hash: HashService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Check an email/password pair. Used by `LocalStrategy`, which turns a `null` into the 401.
   *
   * Returns `null` for both an unknown address and a wrong password, and the caller phrases both
   * the same way: telling the two apart would confirm to a stranger that an address has an
   * account here.
   */
  async validateUser(email: string, password: string): Promise<AuthUserDto | null> {
    // Case-insensitive rather than lowercasing the input: the seed stores `SEED_USER_EMAIL`
    // verbatim, so a configured `Person@example.com` must still match what someone types.
    const user = await this.prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } });

    if (user === null) {
      return null;
    }

    const matches = await this.hash.verify(user.passwordHash, password);

    if (!matches) {
      return null;
    }

    // Rebuilt field by field rather than spread-and-delete: a column added to `User` later
    // cannot leak into a response by accident.
    return { id: user.id, email: user.email, name: user.name, locale: user.locale };
  }

  /** Mint the access token and the account payload that go into the response body. */
  issueSession(user: AuthUserDto): SessionDto {
    return { accessToken: this.signAccessToken(user).token, user };
  }

  /**
   * Mint the long-lived token that goes into the refresh cookie. Signed with its own secret, so
   * an access token can never be replayed as a refresh token, or the other way round.
   */
  issueRefreshToken(user: AuthUserDto): SignedToken {
    return this.sign(user, this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'), this.config.getOrThrow<string>('REFRESH_TOKEN_EXPIRES_IN'));
  }

  /**
   * Exchange a refresh token for a fresh session.
   *
   * The account is re-read on every refresh instead of being trusted from the claims: a deleted
   * account, or one whose name changed, must not survive for the seven days the cookie lives.
   *
   * @throws UnauthorizedException when the token is missing, expired, signed with the wrong
   *   secret, or points at an account that no longer exists — all with the same message.
   */
  async refreshSession(refreshToken: string | undefined): Promise<SessionDto> {
    if (refreshToken === undefined || refreshToken.length === 0) {
      throw new UnauthorizedException('Invalid session');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, { secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid session');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, name: true, locale: true } });

    if (user === null) {
      throw new UnauthorizedException('Invalid session');
    }

    return this.issueSession(user);
  }

  private signAccessToken(user: AuthUserDto): SignedToken {
    return this.sign(user, this.config.getOrThrow<string>('JWT_SECRET'), this.config.getOrThrow<string>('JWT_EXPIRES_IN'));
  }

  /**
   * Sign a token and read its `exp` back out. The expiry is expressed once, as a duration in the
   * environment (`7d`), and the cookie's own lifetime is derived from the claim rather than by
   * parsing that string a second time — the two cannot disagree.
   */
  private sign(user: AuthUserDto, secret: string, expiresIn: string): SignedToken {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    // `expiresIn` is typed as a `ms` template literal (`15m`, `7d`, …), which a value read from
    // the environment can never satisfy statically. Boot-time validation guarantees it is a
    // non-empty string, and jsonwebtoken rejects an unparseable one loudly at the first sign.
    const token = this.jwt.sign(payload, { secret, expiresIn: expiresIn as JwtSignOptions['expiresIn'] });
    const { exp } = this.jwt.decode<JwtPayload & { exp: number }>(token);

    return { token, expiresAt: new Date(exp * 1000) };
  }
}

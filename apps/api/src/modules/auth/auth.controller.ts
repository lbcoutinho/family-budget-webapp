import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { type CookieOptions, type Request, type Response } from 'express';

import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { AuthUserDto } from './dto/auth-user.dto';
import { LoginDto } from './dto/login.dto';
import { SessionDto } from './dto/session.dto';

/** Name of the refresh cookie. Referenced by the tests, so it lives next to the code that sets it. */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Path the refresh cookie is scoped to. `/api/auth` covers `refresh` and `logout` — the only two
 * endpoints that read it — so the browser never attaches a seven-day credential to an ordinary
 * data request.
 */
const REFRESH_TOKEN_PATH = '/api/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Exchange credentials for a session. The guard runs `LocalStrategy` first, so reaching the
   * body of this method already means the password checked out.
   */
  // Public because there is nothing to authenticate with yet — this endpoint is where a token
  // comes from. Marked per route rather than on the controller, so a later endpoint added here
  // (changing a password, say) is protected like everything else unless it says otherwise.
  @Public()
  @ApiOperation({ operationId: 'login', summary: 'Log in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: SessionDto, description: 'Access token in the body; refresh token set as an httpOnly cookie.' })
  @ApiUnauthorizedResponse({ description: 'Wrong password or unknown address — the same answer for both.' })
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(
    // Bound, but unused: `LocalStrategy` reads the credentials straight off the request. It is
    // here so the payload has a validated, documented shape — which is also what the generated
    // client's `login(body)` signature is built from. Note that guards run *before* pipes, so a
    // malformed body is answered by the strategy with 401, not by the pipe with 400.
    @Body() _credentials: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): SessionDto {
    // Populated by LocalStrategy.validate; the guard has already rejected everything else.
    const user = request.user as AuthUserDto;

    this.setRefreshCookie(response, user);

    return this.auth.issueSession(user);
  }

  /**
   * Mint a new access token from the refresh cookie, which is what keeps a browser session alive
   * past the access token's 15 minutes (M2-T05 calls this on a 401).
   */
  // Public to the *bearer* guard, not unauthenticated: the refresh cookie is what authorises it,
  // and the access token is expected to be expired by the time anything calls this.
  @Public()
  @ApiOperation({ operationId: 'refresh', summary: 'Issue a new access token from the refresh cookie' })
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOkResponse({ type: SessionDto, description: 'A fresh access token for the account named by the cookie.' })
  @ApiUnauthorizedResponse({ description: 'Cookie missing, expired, tampered with, or pointing at a deleted account.' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<SessionDto> {
    const session = await this.auth.refreshSession(readRefreshCookie(request));

    // Re-issued on every refresh, so an actively used session slides forward instead of expiring
    // seven days after the last login.
    this.setRefreshCookie(response, session.user);

    return session;
  }

  /**
   * End the session by clearing the cookie.
   */
  // Public for the same reason it was unguarded before the global guard existed: logging out has
  // to work when the access token has already expired, which is exactly when a user reaches for
  // it. The worst it can do is delete a cookie.
  @Public()
  @ApiOperation({ operationId: 'logout', summary: 'Clear the refresh cookie' })
  @ApiNoContentResponse({ description: 'The refresh cookie is cleared; the access token is left to expire on its own.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): void {
    // Same attributes as when it was set, minus the expiry — a browser only replaces a cookie
    // when name, path and domain all match.
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions());
  }

  private setRefreshCookie(response: Response, user: AuthUserDto): void {
    const { token, expiresAt } = this.auth.issueRefreshToken(user);

    response.cookie(REFRESH_TOKEN_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  /**
   * `httpOnly` keeps the token away from any script on the page, and `sameSite: 'strict'` means
   * the browser never sends it from another site — which is what stands in for CSRF protection
   * on the refresh endpoint (ADR-0011). `secure` is off in development because the dev server is
   * plain HTTP; in production the cookie must never travel unencrypted.
   */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      path: REFRESH_TOKEN_PATH,
    };
  }
}

/**
 * Read the refresh cookie off the request. `cookie-parser` types `request.cookies` as `any`, so
 * it is narrowed here, once, instead of at every call site.
 */
function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string | undefined> | undefined;

  return cookies?.[REFRESH_TOKEN_COOKIE];
}

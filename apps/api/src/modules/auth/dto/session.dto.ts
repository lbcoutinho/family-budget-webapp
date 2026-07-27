import { ApiProperty } from '@nestjs/swagger';

import { AuthUserDto } from './auth-user.dto';

/**
 * Response body of `POST /api/auth/login` and `POST /api/auth/refresh`.
 *
 * The access token travels in the body because the frontend keeps it in memory rather than in
 * `localStorage` (ADR-0011). The refresh token is *not* here — it goes out as an `httpOnly`
 * cookie, so no JavaScript on the page can read it.
 *
 * The account is included so a page reload can rebuild the session from the silent refresh
 * alone (M2-T05/M2-T06), without a second round-trip to a "who am I" endpoint.
 */
export class SessionDto {
  @ApiProperty({ type: String, description: 'Short-lived bearer token, sent as `Authorization: Bearer <token>`.' })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto, description: 'The authenticated account, without its password hash.' })
  user!: AuthUserDto;
}

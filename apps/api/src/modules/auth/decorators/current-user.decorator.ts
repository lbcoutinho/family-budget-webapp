import { type ExecutionContext, InternalServerErrorException, createParamDecorator } from '@nestjs/common';
import { type Request } from 'express';

import { type AuthenticatedUser } from '../authenticated-user';

/**
 * The decorator's implementation, exported on its own so it can be unit-tested — a
 * `createParamDecorator` result is only reachable through a running request otherwise.
 *
 * @throws InternalServerErrorException when nothing authenticated the request. That is not a
 *   failed login but a wiring mistake — `@CurrentUser()` on a `@Public()` route — and it must not
 *   be answered with a 401 that would send the frontend into a pointless refresh.
 */
export function currentUserFactory(_data: unknown, context: ExecutionContext): AuthenticatedUser {
  const request = context.switchToHttp().getRequest<Request>();
  const user = request.user as AuthenticatedUser | undefined;

  if (user === undefined) {
    throw new InternalServerErrorException('@CurrentUser() used on a route that is not authenticated');
  }

  return user;
}

/**
 * Injects the authenticated account into a controller argument, so a handler never reaches into
 * `request.user` and never has to cast it:
 *
 * ```ts
 * findAll(@CurrentUser() user: AuthenticatedUser) { … }
 * ```
 *
 * Every domain entity carries a `userId` (ADR-0006), so this is the argument almost every future
 * handler starts from.
 */
export const CurrentUser = createParamDecorator(currentUserFactory);

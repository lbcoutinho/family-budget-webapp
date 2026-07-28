import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { type Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from './decorators/public.decorator';

/**
 * The global guard (ADR-0011): registered as an `APP_GUARD`, so a route is protected the moment
 * it is written and stays protected unless someone marks it `@Public()`. Guarding route by route
 * is the same work done repeatedly, and it only has to be forgotten once.
 *
 * Everything else — pulling the bearer token, checking the signature and the expiry — is
 * `JwtStrategy`'s, reached through `AuthGuard('jwt')`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Handler first, then controller: a `@Public()` class opens all its routes, and a `@Public()`
    // method opens one route on an otherwise protected controller.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic === true) {
      return true;
    }

    return super.canActivate(context);
  }
}

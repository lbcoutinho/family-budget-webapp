import { type ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * The prototype `JwtAuthGuard` inherits from — the mixin `AuthGuard('jwt')` produced. Spying on
 * it is what makes "did the guard delegate to Passport?" observable, since a real delegation
 * would need a request with a token on it.
 */
const passportGuardPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
  canActivate: (context: ExecutionContext) => boolean;
};

describe('JwtAuthGuard', () => {
  const handler = (): void => undefined;

  class ProbeController {}

  const context = {
    getHandler: () => handler,
    getClass: () => ProbeController,
  } as unknown as ExecutionContext;

  /** A guard whose reflector answers with the given `@Public()` metadata, or nothing at all. */
  const guardSeeing = (isPublic: boolean | undefined): JwtAuthGuard => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) } as unknown as Reflector;

    return new JwtAuthGuard(reflector);
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets a @Public() route through without consulting Passport', () => {
    const delegate = jest.spyOn(passportGuardPrototype, 'canActivate');

    expect(guardSeeing(true).canActivate(context)).toBe(true);
    expect(delegate).not.toHaveBeenCalled();
  });

  it('reads the metadata from the handler first and the controller second', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;

    // The `@Public()` answer above makes this synchronous; nothing to await.
    void new JwtAuthGuard(reflector).canActivate(context);

    // Handler before class: a @Public() method opens one route on a protected controller.
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, ProbeController]);
  });

  it('delegates to Passport when the route carries no @Public() metadata', () => {
    const delegate = jest.spyOn(passportGuardPrototype, 'canActivate').mockReturnValue(true);

    expect(guardSeeing(undefined).canActivate(context)).toBe(true);
    expect(delegate).toHaveBeenCalledWith(context);
  });

  it('delegates rather than short-circuiting when the metadata is explicitly false', () => {
    const delegate = jest.spyOn(passportGuardPrototype, 'canActivate').mockReturnValue(false);

    expect(guardSeeing(false).canActivate(context)).toBe(false);
    expect(delegate).toHaveBeenCalledWith(context);
  });
});

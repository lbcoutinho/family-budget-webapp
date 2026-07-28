import { type ExecutionContext, InternalServerErrorException } from '@nestjs/common';

import { type AuthenticatedUser } from '../authenticated-user';

import { currentUserFactory } from './current-user.decorator';

describe('currentUserFactory', () => {
  /** An execution context wrapping a request that carries the given `user`, or none. */
  const contextFor = (user: AuthenticatedUser | undefined): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

  it('returns the account the guard put on the request', () => {
    const user: AuthenticatedUser = { id: '6f9619ff-8b86-d011-b42d-00c04fc964ff', email: 'person@example.com' };

    expect(currentUserFactory(undefined, contextFor(user))).toBe(user);
  });

  it('fails loudly when nothing authenticated the request', () => {
    // A 500, not a 401: reaching this means the route is @Public() and still asks for a user,
    // which no amount of logging in would fix.
    expect(() => currentUserFactory(undefined, contextFor(undefined))).toThrow(InternalServerErrorException);
  });
});

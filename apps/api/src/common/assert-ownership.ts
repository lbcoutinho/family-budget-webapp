import { NotFoundException } from '@nestjs/common';

/**
 * The one place the API decides what "someone else's record" looks like from the outside: a 404,
 * never a 403. A 403 would confirm the id exists, which is exactly the fact another account has no
 * business learning (ADR-0006 makes `userId` the tenancy boundary; this makes it unobservable).
 *
 * Takes the row as read — `null` included, so the missing case and the not-yours case are one call
 * and cannot drift apart:
 *
 * ```ts
 * const account = assertOwnership(await this.prisma.account.findUnique({ where: { id } }), userId);
 * ```
 *
 * Returns the row rather than being a TypeScript `asserts` function: an assertion signature cannot
 * be called on an inline expression, which would force a two-line dance at every call site.
 *
 * @throws NotFoundException when the row does not exist, or belongs to another account.
 */
export function assertOwnership<T extends { userId: string }>(entity: T | null | undefined, userId: string): T {
  if (entity?.userId !== userId) {
    throw new NotFoundException('The requested record was not found.');
  }

  return entity;
}

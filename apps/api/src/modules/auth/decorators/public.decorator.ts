import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

/** Metadata key `JwtAuthGuard` reads. Exported so the guard and its spec name the same string. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route — or a whole controller — to unauthenticated callers. Every other route is
 * protected by the global `JwtAuthGuard`, so this decorator is the only way in without a token,
 * and its presence in a diff is the thing a reviewer should stop on.
 *
 * It also clears the document-wide bearer requirement for that operation, so the Swagger UI does
 * not demand a token the route ignores. The two go together on purpose: the intent is stated
 * once, and the guard and the published contract cannot drift apart.
 */
export function Public(): MethodDecorator & ClassDecorator {
  // `ApiSecurity({})` emits an empty security requirement (`security: [{}]`). An operation-level
  // `security` replaces the root-level one outright, and an empty requirement means "no
  // credentials needed".
  return applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiSecurity({}));
}

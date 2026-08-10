import { BadRequestException, ConflictException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Every business error the API can answer with (M3-T11, ADR-0018). The `code` is what the client
 * renders — it looks up `errors.<CODE>` in its locale files — while the `message` below stays
 * English, is meant for logs and Swagger, and is never shown to a user.
 *
 * A code is part of the contract: rename one and a translated string silently becomes the generic
 * fallback. Add codes, do not repurpose them.
 */
export const ERROR_CODES = [
  /** Not a business error: the fallback the Prisma filter emits for a code it does not map. */
  'INTERNAL_ERROR',
  /** Unique constraint (P2002): the user already has a record with that name. */
  'DUPLICATE_NAME',
  /** Foreign key constraint (P2003): other rows still point at this one, so it cannot be deleted. */
  'RECORD_IN_USE',
  /** No such record, or it belongs to another user — the two are deliberately indistinguishable. */
  'RECORD_NOT_FOUND',
  'CATEGORY_ROOT_KIND_REQUIRED',
  'CATEGORY_SELF_PARENT',
  /** The row being moved under a parent still has children of its own. */
  'CATEGORY_HAS_SUBCATEGORIES',
  /** The chosen parent is itself a subcategory: the tree is two levels deep. */
  'CATEGORY_TREE_TOO_DEEP',
  'CATEGORY_SUBCATEGORY_KIND_MISMATCH',
  'CATEGORY_SUBCATEGORY_COLOR_NOT_ALLOWED',
  'CATEGORY_LAST_ACTIVE_SUBCATEGORY',
  /** Required for this transaction type, but absent (M4-T02). */
  'TRANSACTION_FIELD_REQUIRED',
  /** Forbidden for this transaction type, but present (M4-T02). */
  'TRANSACTION_FIELD_NOT_ALLOWED',
  /** `destinationAccountId === accountId` on a `TRANSFER`. */
  'TRANSACTION_SAME_ACCOUNT',
  /** `destinationCashboxId === cashboxId` on a `CASHBOX_TRANSFER`. */
  'TRANSACTION_SAME_CASHBOX',
  /** A referenced account, category, subcategory or cashbox is deactivated (ADR-0015). */
  'TRANSACTION_REFERENCE_INACTIVE',
  /** `category.kind` incompatible with the transaction type. */
  'TRANSACTION_CATEGORY_KIND_MISMATCH',
  /** `subcategory.parentId !== categoryId`. */
  'TRANSACTION_SUBCATEGORY_PARENT_MISMATCH',
  /** `PATCH` tried to change `type` (M4-T04) — not supported, `type` is fixed at creation. */
  'TRANSACTION_TYPE_IMMUTABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Shape of every business-error response body. Declared so the generated client types `code`. */
export class ApiErrorDto {
  @ApiProperty({ type: Number, example: HttpStatus.CONFLICT })
  statusCode!: number;

  @ApiProperty({ type: String, enum: ERROR_CODES, description: 'Stable code the client maps to a translated message.' })
  code!: ErrorCode;

  @ApiProperty({ type: String, description: 'English, for logs and debugging. Clients render the `code`, never this.' })
  message!: string;
}

// The status lives in the body as well as on the response: `HttpException` hands an object payload
// to the client verbatim, so anything not written here is not sent.
export const badRequest = (code: ErrorCode, message: string): BadRequestException =>
  new BadRequestException({ statusCode: HttpStatus.BAD_REQUEST, code, message } satisfies ApiErrorDto);

export const conflict = (code: ErrorCode, message: string): ConflictException =>
  new ConflictException({ statusCode: HttpStatus.CONFLICT, code, message } satisfies ApiErrorDto);

export const notFound = (code: ErrorCode, message: string): NotFoundException =>
  new NotFoundException({ statusCode: HttpStatus.NOT_FOUND, code, message } satisfies ApiErrorDto);

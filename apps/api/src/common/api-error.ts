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
  /** `CASHBOX_OUT`/`CASHBOX_TRANSFER` would drive a cashbox balance negative (M4-T05). */
  'CASHBOX_INSUFFICIENT_FUNDS',
  /** Delete refused because the cashbox still holds money (M4-T09, ADR-0019). */
  'CASHBOX_NOT_EMPTY',
  /** A `RecurrenceRule.type` outside `INCOME`/`EXPENSE` reached the generator (M7-T02). */
  'RECURRENCE_TYPE_NOT_ALLOWED',
  /** `endDate` at or before `startDate` on a `RecurrenceRule` (M7-T03). */
  'RECURRENCE_END_BEFORE_START',
  /** `installments < 1` reached `splitInstallments` — the DTO's `@Min(2)` should already have caught it (M7-T04). */
  'INSTALLMENT_COUNT_INVALID',
  /** `totalAmount < installments` — an installment cannot be 0 cents (M7-T04). */
  'INSTALLMENT_AMOUNT_TOO_LOW',
  /** `POST /recurrence-rules/:id/cancel-installments` on a rule with `totalOccurrences = null` — that's an open-ended rule, deactivated through `DELETE` instead (M7-T04). */
  'RECURRENCE_NOT_INSTALLMENT_PLAN',
  /** `amount = null` on a `RecurrenceRule` with `autoConfirm = true` — a rule that auto-confirms must know what it confirms (ADR-0020). */
  'RECURRENCE_AMOUNT_REQUIRED_WHEN_AUTO_CONFIRM',
  /** `amount = null` on a `Transaction` whose `status` is (or would become) `CONFIRMED` (ADR-0020). */
  'TRANSACTION_AMOUNT_REQUIRED_WHEN_CONFIRMED',
  'CSV_IMPORT_FILE_REQUIRED',
  'CSV_IMPORT_FILE_TOO_LARGE',
  'CSV_IMPORT_FILE_NOT_UTF8',
  'CSV_IMPORT_FILE_INVALID',
  'CSV_IMPORT_TOO_MANY_ROWS',
  'CSV_IMPORT_HEADER_LINE_MISSING',
  'CSV_IMPORT_NO_TRANSACTION_ROWS',
  'CSV_IMPORT_MAPPED_HEADER_MISSING',
  'CSV_IMPORT_MAPPED_HEADER_AMBIGUOUS',
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

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { TransactionStatus, TransactionType } from '../../../generated/prisma/client';

import { toDateOnly } from './date-only.transform';

/** The five orderings the month screen's sort control offers (M5-T07). Keyed by intent rather than
 * an orthogonal `sortBy`/`sortOrder` pair, which would admit combinations the UI never offers. */
export enum TransactionSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  AMOUNT_HIGHEST = 'amountHighest',
  AMOUNT_LOWEST = 'amountLowest',
  DESCRIPTION = 'description',
}

/** Query string of `GET /api/transactions` (M4-T08). */
export class ListTransactionsQueryDto {
  @ApiProperty({
    type: String,
    format: 'date',
    required: false,
    example: '2026-03-01',
    description: 'Normalized to the 1st before matching, same as the create/update body.',
  })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'referenceMonth must be in the form YYYY-MM-DD.' })
  referenceMonth?: Date;

  @ApiProperty({ type: String, format: 'date', required: false, example: '2026-03-01', description: 'Inclusive lower bound on `date`.' })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'dateFrom must be in the form YYYY-MM-DD.' })
  dateFrom?: Date;

  @ApiProperty({ type: String, format: 'date', required: false, example: '2026-03-31', description: 'Inclusive upper bound on `date`.' })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'dateTo must be in the form YYYY-MM-DD.' })
  dateTo?: Date;

  @ApiProperty({ type: String, enum: TransactionType, enumName: 'TransactionType', isArray: true, required: false })
  // A query string carries a single `?type=EXPENSE` as a plain string, and only a repeated
  // `?type=A&type=B` as an array — the transform normalizes both shapes to an array.
  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown[] => (Array.isArray(value) ? (value as unknown[]) : [value]))
  @IsEnum(TransactionType, { each: true })
  type?: TransactionType[];

  @ApiProperty({
    type: String,
    enum: TransactionStatus,
    enumName: 'TransactionStatus',
    required: false,
    description: 'Omitted ⇒ `CONFIRMED` only (ADR-0012) — balances and reports never see a `DRAFT`.',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({ type: String, format: 'uuid', required: false, description: 'Matches the source `accountId` only — a TRANSFER shows up under it.' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({ type: String, format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ type: String, format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    required: false,
    description: 'Matches the live foreign key only — a row whose cashbox was since deleted is excluded (ADR-0019), even though its `cashboxLabel` remains.',
  })
  @IsOptional()
  @IsUUID()
  cashboxId?: string;

  @ApiProperty({ type: Boolean, required: false })
  // Same explicit `'true'` string compare as `ListAccountsQueryDto`: a query string never carries
  // an actual boolean, and `ValidationPipe`'s `transform` would coerce any non-empty string —
  // including `'false'` — to `true` otherwise.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  @IsOptional()
  @IsBoolean()
  isCreditCard?: boolean;

  @ApiProperty({ type: String, required: false, maxLength: 200, description: 'Case-insensitive, matches `description` or `notes`.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiProperty({ type: String, format: 'uuid', required: false, description: 'Opaque to the client — the id of the last row of the previous page.' })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiProperty({ type: Number, required: false, default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @ApiProperty({
    type: String,
    enum: TransactionSort,
    enumName: 'TransactionSort',
    required: false,
    default: TransactionSort.NEWEST,
    description: 'Server-side ordering of the whole filtered set, not just the loaded pages.',
  })
  @IsOptional()
  @IsEnum(TransactionSort)
  sort: TransactionSort = TransactionSort.NEWEST;
}

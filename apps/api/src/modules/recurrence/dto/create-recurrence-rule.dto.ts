import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { toDateOnly } from '../../transactions/dto/date-only.transform';

/**
 * Request body of `POST /api/recurrence-rules`. `userId`, `isActive` and `generatedUntil` are never
 * accepted from a client — the schema defaults apply and `generatedUntil` only ever moves through
 * `RecurrenceGeneratorService` (M7-T02).
 *
 * `type` is restricted to `INCOME`/`EXPENSE` here even though the schema's `TransactionType` is
 * wider (M7-T02, `RECURRENCE_TYPE_NOT_ALLOWED`) — no point letting a client create a rule the
 * generator will always reject.
 *
 * `accountId`/`categoryId`/`subcategoryId` are declared optional even though `TransactionValidator`
 * requires all three for `INCOME`/`EXPENSE`: shape enforcement lives in one place (M4-T02), reused
 * here rather than duplicated.
 */
export class CreateRecurrenceRuleDto {
  @ApiProperty({ type: String, enum: ['INCOME', 'EXPENSE'], enumName: 'RecurrenceRuleType' })
  @IsIn(['INCOME', 'EXPENSE'])
  type!: 'INCOME' | 'EXPENSE';

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    example: 1_000,
    description:
      'Always positive when present, in **cents** (ADR-0005) — copied onto each generated transaction. Null means a variable amount (e.g. a utility ' +
      'bill); legal only when `autoConfirm` is false (ADR-0020).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number | null;

  @ApiProperty({ type: String, maxLength: 200, example: 'Rent' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;

  @ApiProperty({ type: String, required: false, nullable: true, maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiProperty({ type: String, format: 'uuid', required: false })
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

  @ApiProperty({ type: String, enum: ['MONTHLY', 'YEARLY'], enumName: 'RecurrenceFrequency' })
  @IsIn(['MONTHLY', 'YEARLY'])
  frequency!: 'MONTHLY' | 'YEARLY';

  @ApiProperty({ type: Number, required: false, default: 1, description: 'Every N months/years, per `frequency`.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  interval?: number;

  @ApiProperty({ type: Number, example: 15, description: '1–31; a day that does not exist in the target month falls back to that month’s last day.' })
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth!: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-01', description: 'First possible occurrence, `YYYY-MM-DD`.' })
  @Transform(toDateOnly)
  @IsDate({ message: 'startDate must be in the form YYYY-MM-DD.' })
  startDate!: Date;

  @ApiProperty({
    type: String,
    format: 'date',
    required: false,
    nullable: true,
    example: '2027-03-01',
    description: 'Last possible occurrence, `YYYY-MM-DD`. Null means open-ended.',
  })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'endDate must be in the form YYYY-MM-DD.' })
  endDate?: Date | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    example: 12,
    description: 'Lifetime cap on generated occurrences — installments. Null or omitted means open-ended recurrence (ADR-0014).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalOccurrences?: number | null;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
    description: 'Whether a generated entry starts `CONFIRMED` (fixed amount) or `DRAFT` (variable amount, e.g. a utility bill).',
  })
  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;
}

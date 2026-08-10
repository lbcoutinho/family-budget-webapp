import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// `ValidationPipe` runs `class-transformer` before `class-validator`, so a `@Matches` decorator
// here would see the already-converted `Date`, not the original string — the format check has to
// happen inside the transform itself. A string that fails it passes through unconverted, so the
// `@IsDate` below is what actually rejects it.
//
// The explicit `Z` matters: the column is `@db.Date`, and parsing without it would shift the day
// on a negative-offset host.
const toDateOnly = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000Z`) : value;

/**
 * Request body of `POST /api/transactions`. `userId`, `status` and `source` are never accepted
 * from a client — the schema defaults (`CONFIRMED` / `MANUAL`) apply; `DRAFT` arrives with voice
 * entry (M8).
 *
 * `type` accepts `INCOME`/`EXPENSE` (M4-T04) and `CASHBOX_IN`/`CASHBOX_OUT`/`CASHBOX_TRANSFER`
 * (M4-T05, #102). `TRANSFER` remains rejected with the framework's generic 400 until #103 lands.
 *
 * `accountId`/`categoryId`/`subcategoryId` are declared optional even though
 * `TransactionValidator.assertShape` requires all three for `INCOME`/`EXPENSE`: shape enforcement
 * lives in one place, and this DTO is shared with the transaction types added later, where the
 * required set differs.
 */
export class CreateTransactionDto {
  @ApiProperty({
    type: String,
    enum: ['INCOME', 'EXPENSE', 'CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'],
    enumName: 'CreateTransactionType',
  })
  @IsIn(['INCOME', 'EXPENSE', 'CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'])
  type!: 'INCOME' | 'EXPENSE' | 'CASHBOX_IN' | 'CASHBOX_OUT' | 'CASHBOX_TRANSFER';

  @ApiProperty({ type: Number, example: 1_000, description: 'Always positive, in **cents** (ADR-0005) — sign is derived from `type`.' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-15', description: 'When it happened, `YYYY-MM-DD`.' })
  @Transform(toDateOnly)
  @IsDate({ message: 'date must be in the form YYYY-MM-DD.' })
  date!: Date;

  @ApiProperty({
    type: String,
    format: 'date',
    required: false,
    example: '2026-03-01',
    description: 'Which month it reports in, `YYYY-MM-DD`. Derived from `date` when omitted, normalized to the 1st when supplied (ADR-0009).',
  })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'referenceMonth must be in the form YYYY-MM-DD.' })
  referenceMonth?: Date;

  @ApiProperty({ type: String, maxLength: 200, example: 'Coffee' })
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

  @ApiProperty({ type: Boolean, required: false, default: false, description: 'Drives whether editing `date` recomputes `referenceMonth` (ADR-0009).' })
  @IsOptional()
  @IsBoolean()
  isCreditCard?: boolean;

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

  @ApiProperty({ type: String, format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  cashboxId?: string;

  @ApiProperty({ type: String, format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  destinationCashboxId?: string;
}

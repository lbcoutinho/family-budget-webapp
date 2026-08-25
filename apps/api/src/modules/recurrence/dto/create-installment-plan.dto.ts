import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { toDateOnly } from '../../transactions/dto/date-only.transform';

/**
 * Request body of `POST /api/recurrence-rules/installment` (M7-T04). Materializes every installment
 * up front instead of on the rolling horizon `CreateRecurrenceRuleDto` uses — the whole commitment
 * has to be visible immediately.
 *
 * `totalAmount` is the **whole purchase**, in cents; the per-row amount is derived by
 * `splitInstallments` in the service, never accepted from the client.
 */
export class CreateInstallmentPlanDto {
  @ApiProperty({ type: String, enum: ['INCOME', 'EXPENSE'], enumName: 'RecurrenceRuleType', required: false, default: 'EXPENSE' })
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE'])
  type?: 'INCOME' | 'EXPENSE';

  @ApiProperty({ type: Number, example: 30_000, description: 'The whole purchase, in **cents** (ADR-0005) — not the per-installment amount.' })
  @IsInt()
  @Min(1)
  totalAmount!: number;

  @ApiProperty({ type: Number, minimum: 2, maximum: 120, example: 3, description: '1 installment is a plain transaction, not a plan.' })
  @IsInt()
  @Min(2)
  @Max(120)
  installments!: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-15', description: 'Expected statement payment date of installment 1.' })
  @Transform(toDateOnly)
  @IsDate({ message: 'firstPaymentDate must be in the form YYYY-MM-DD.' })
  firstPaymentDate!: Date;

  @ApiProperty({ type: String, format: 'date', example: '2026-02-20', description: 'The original purchase date.' })
  @Transform(toDateOnly)
  @IsDate({ message: 'purchaseDate must be in the form YYYY-MM-DD.' })
  purchaseDate!: Date;

  @ApiProperty({ type: String, maxLength: 160, example: 'New sofa' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  description!: string;

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

  @ApiProperty({ type: Boolean, required: false, default: false, description: 'Keeps `referenceMonth` pinned on a later `date` edit (ADR-0009).' })
  @IsOptional()
  @IsBoolean()
  isCreditCard?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
    description: 'Installment amounts are known up front, so this defaults to `true` unlike an open-ended rule.',
  })
  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;
}

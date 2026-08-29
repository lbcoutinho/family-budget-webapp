import { ApiProperty } from '@nestjs/swagger';

import { TransactionSource, TransactionStatus, TransactionType } from '../../../generated/prisma/client';

/**
 * A transaction as the API hands it out. Deliberately not the Prisma row: `userId` is the
 * tenancy boundary, not information a client needs. `date` and `referenceMonth` are rendered as
 * plain `YYYY-MM-DD` — they are `@db.Date` columns, never a time of day.
 */
export class TransactionDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  id!: string;

  @ApiProperty({ enum: TransactionType, enumName: 'TransactionType' })
  type!: TransactionType;

  @ApiProperty({ enum: TransactionStatus, enumName: 'TransactionStatus' })
  status!: TransactionStatus;

  @ApiProperty({ enum: TransactionSource, enumName: 'TransactionSource' })
  source!: TransactionSource;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1_000,
    description: 'Always positive when present, in **cents** (ADR-0005). Null means unknown yet; only possible on a DRAFT (ADR-0020).',
  })
  amount!: number | null;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-15' })
  date!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-01' })
  referenceMonth!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-15' })
  settlementDate!: string;

  @ApiProperty({ type: String, example: 'Coffee' })
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: Boolean })
  isCreditCard!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  accountId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  destinationAccountId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  categoryId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  subcategoryId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  cashboxId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  destinationCashboxId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cashboxLabel!: string | null;

  @ApiProperty({ type: String, nullable: true })
  destinationCashboxLabel!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The recurrence rule that generated this transaction. Null for manual entries.' })
  recurrenceRuleId!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 3, description: '1-based position within its installment plan. Null outside installment plans.' })
  installmentNumber!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 12, description: 'Total installments in the plan. Null outside installment plans.' })
  installmentTotal!: number | null;
}

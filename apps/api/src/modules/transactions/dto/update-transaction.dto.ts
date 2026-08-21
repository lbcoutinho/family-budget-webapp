import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

import { TransactionStatus } from '../../../generated/prisma/client';

import { CreateTransactionDto } from './create-transaction.dto';

/**
 * Request body of `PATCH /api/transactions/:id` — every field of the create body, all optional.
 *
 * `type` is re-added on top of `PartialType(OmitType(...))` and kept optional: a client sending
 * it does not silently no-op, it gets `TRANSACTION_TYPE_IMMUTABLE` — `type` cannot change once a
 * transaction exists.
 *
 * `amount` widens to nullable on top of the inherited field — clearing a DRAFT's amount back to
 * unknown is legal, `TRANSACTION_AMOUNT_REQUIRED_WHEN_CONFIRMED` is not (ADR-0020).
 *
 * `status` only ever moves `DRAFT` -> `CONFIRMED` (the confirm action); the API never accepts the
 * reverse.
 */
export class UpdateTransactionDto extends PartialType(OmitType(CreateTransactionDto, ['type', 'amount'])) {
  @ApiProperty({
    type: String,
    enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'],
    enumName: 'CreateTransactionType',
    required: false,
    description: 'Rejected: `type` is immutable after creation.',
  })
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE', 'TRANSFER', 'CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'])
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'CASHBOX_IN' | 'CASHBOX_OUT' | 'CASHBOX_TRANSFER';

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    example: 1_000,
    description: 'Always positive when present, in **cents** (ADR-0005). Null is only legal while the transaction stays DRAFT.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number | null;

  @ApiProperty({
    type: String,
    enum: [TransactionStatus.CONFIRMED],
    enumName: 'ConfirmTransactionStatus',
    required: false,
    description: 'The confirm action: moves a DRAFT to CONFIRMED. Rejected with `TRANSACTION_AMOUNT_REQUIRED_WHEN_CONFIRMED` when amount is still null.',
  })
  @IsOptional()
  @IsIn([TransactionStatus.CONFIRMED])
  status?: typeof TransactionStatus.CONFIRMED;
}

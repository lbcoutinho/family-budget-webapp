import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { CreateTransactionDto } from './create-transaction.dto';

/**
 * Request body of `PATCH /api/transactions/:id` — every field of the create body, all optional.
 *
 * `type` is re-added on top of `PartialType(OmitType(...))` and kept optional: a client sending
 * it does not silently no-op, it gets `TRANSACTION_TYPE_IMMUTABLE` — `type` cannot change once a
 * transaction exists.
 */
export class UpdateTransactionDto extends PartialType(OmitType(CreateTransactionDto, ['type'])) {
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
}

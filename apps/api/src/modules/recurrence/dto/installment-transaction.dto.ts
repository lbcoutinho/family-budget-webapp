import { ApiProperty, OmitType } from '@nestjs/swagger';

import { TransactionDto } from '../../transactions/dto/transaction.dto';

/**
 * `TransactionDto` with `recurrenceRuleId`/`installmentNumber`/`installmentTotal` narrowed from
 * nullable to required (#208 made them nullable on `TransactionDto` itself for the general listing) —
 * every row the plan-creation response hands back is one of its own installments, so these three are
 * always set here. `OmitType` (rather than plain `extends`) sidesteps re-declaring an inherited field
 * with an incompatible type.
 */
export class InstallmentTransactionDto extends OmitType(TransactionDto, ['recurrenceRuleId', 'installmentNumber', 'installmentTotal'] as const) {
  @ApiProperty({ type: String, format: 'uuid' })
  recurrenceRuleId!: string;

  @ApiProperty({ type: Number, example: 3, description: "This row's position among the plan's installments." })
  installmentNumber!: number;

  @ApiProperty({ type: Number, example: 10, description: "The plan's total installment count." })
  installmentTotal!: number;
}

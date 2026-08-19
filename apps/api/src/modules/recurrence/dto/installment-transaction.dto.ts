import { ApiProperty } from '@nestjs/swagger';

import { TransactionDto } from '../../transactions/dto/transaction.dto';

/**
 * `TransactionDto` plus the three installment-only fields (M7-T04). The general transaction listing
 * (M4) deliberately omits these — most rows are not installments — but the plan-creation response
 * hands them back so #200's form can show what it produced without a second round-trip.
 */
export class InstallmentTransactionDto extends TransactionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  recurrenceRuleId!: string;

  @ApiProperty({ type: Number, example: 3, description: "This row's position among the plan's installments." })
  installmentNumber!: number;

  @ApiProperty({ type: Number, example: 10, description: "The plan's total installment count." })
  installmentTotal!: number;
}

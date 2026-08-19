import { ApiProperty } from '@nestjs/swagger';

import { InstallmentTransactionDto } from './installment-transaction.dto';
import { RecurrenceRuleDto } from './recurrence-rule.dto';

/** Response body of `POST /api/recurrence-rules/installment`: the rule plus every row it materialized. */
export class InstallmentPlanDto {
  @ApiProperty({ type: RecurrenceRuleDto })
  rule!: RecurrenceRuleDto;

  @ApiProperty({ type: [InstallmentTransactionDto] })
  installments!: InstallmentTransactionDto[];
}

import { ApiProperty } from '@nestjs/swagger';

class MonthlyBalanceAccountDto {
  @ApiProperty({ type: String, format: 'uuid' })
  accountId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Number, description: 'Closing balance in cents.' })
  balance!: number;
}

/** `GET /api/reports/monthly-balance`: asset position at an accounting month's close. */
export class MonthlyBalanceDto {
  @ApiProperty({ type: Number, example: 2026 })
  year!: number;

  @ApiProperty({ type: Number, example: 3 })
  month!: number;

  @ApiProperty({ type: Number, description: 'Consolidated account balance at the previous reference-month close, in cents.' })
  previousAccountBalance!: number;

  @ApiProperty({ type: Number, description: 'Consolidated account balance at this reference-month close, in cents.' })
  accountBalance!: number;

  @ApiProperty({ type: MonthlyBalanceAccountDto, isArray: true })
  accounts!: MonthlyBalanceAccountDto[];

  @ApiProperty({ type: Number, description: 'Consolidated cashbox balance at this reference-month close, in cents.' })
  cashboxBalance!: number;

  @ApiProperty({ type: Number, description: 'accountBalance plus cashboxBalance, in cents.' })
  netWorth!: number;
}

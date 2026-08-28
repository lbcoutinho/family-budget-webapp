import { ApiProperty } from '@nestjs/swagger';

class BalancesReportAccountDto {
  @ApiProperty({ type: String, format: 'uuid' })
  accountId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Number, description: 'Balance in cents.' })
  balance!: number;
}

class BalancesReportCashboxDto {
  @ApiProperty({ type: String, format: 'uuid' })
  cashboxId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: Number, description: 'Balance in cents.' })
  balance!: number;
}

class BalancesReportSnapshotDto {
  @ApiProperty({ type: String, format: 'date', description: 'Inclusive effective-balance cutoff.' })
  cutoffDate!: string;

  @ApiProperty({ type: BalancesReportAccountDto, isArray: true })
  accounts!: BalancesReportAccountDto[];

  @ApiProperty({ type: BalancesReportCashboxDto, isArray: true })
  cashboxes!: BalancesReportCashboxDto[];

  @ApiProperty({ type: Number, description: 'Consolidated account balance in cents.' })
  totalAccounts!: number;

  @ApiProperty({ type: Number, description: 'Consolidated cashbox balance in cents.' })
  totalCashboxes!: number;

  @ApiProperty({ type: Number, description: 'Consolidated net worth in cents.' })
  totalNetWorth!: number;
}

class BalancesReportEvolutionMonthDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 })
  month!: number;

  @ApiProperty({ type: Number, description: 'Consolidated account close in cents.' })
  accounts!: number;

  @ApiProperty({ type: Number, description: 'Consolidated cashbox close in cents.' })
  cashboxes!: number;

  @ApiProperty({ type: Number, description: 'Consolidated net-worth close in cents.' })
  netWorth!: number;

  @ApiProperty({ type: Boolean, description: 'True only for the current accounting month.' })
  inProgress!: boolean;
}

class BalancesReportEvolutionDto {
  @ApiProperty({ type: Boolean, description: 'False when no account existed by the selected year end; the snapshot remains available.' })
  hasSufficientHistory!: boolean;

  @ApiProperty({ type: BalancesReportEvolutionMonthDto, isArray: true })
  months!: BalancesReportEvolutionMonthDto[];
}

/** `GET /api/reports/balances`: effective position plus accounting-close comparison and evolution. */
export class BalancesReportDto {
  @ApiProperty({ type: Number })
  year!: number;

  @ApiProperty({ type: BalancesReportSnapshotDto })
  snapshot!: BalancesReportSnapshotDto;

  @ApiProperty({ type: Number, description: 'Current reference-month accounting net-worth close in cents.' })
  currentAccountingClose!: number;

  @ApiProperty({ type: Number, description: 'Current accounting close minus the effective snapshot, in cents.' })
  futureDatedTransactions!: number;

  @ApiProperty({ type: BalancesReportEvolutionDto })
  evolution!: BalancesReportEvolutionDto;
}

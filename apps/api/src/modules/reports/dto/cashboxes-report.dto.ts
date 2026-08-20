import { ApiProperty } from '@nestjs/swagger';

class CashboxesReportMonthDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 })
  month!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_IN this month.' })
  deposits!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_OUT this month.' })
  withdrawals!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Cents, running balance including this month. `null` from the month after a deleted cashbox (ADR-0019) stopped being active.',
  })
  balance!: number | null;
}

class CashboxesReportCashboxDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: '`null` when the cashbox was since deleted (ADR-0019); `name` still carries its label snapshot, and the row is not clickable.',
  })
  cashboxId!: string | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Boolean, nullable: true, description: '`null` when `cashboxId` is `null` — a deleted cashbox has no entity left to be active or not.' })
  isActive!: boolean | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Cents. `null` when unset, or when `cashboxId` is `null`.' })
  targetAmount!: number | null;

  @ApiProperty({ type: Number, description: 'Cents, everything confirmed before January of the requested year.' })
  openingBalance!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_IN summed over the requested year.' })
  deposits!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_OUT summed over the requested year.' })
  withdrawals!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_TRANSFER received summed over the requested year.' })
  transfersIn!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_TRANSFER sent summed over the requested year.' })
  transfersOut!: number;

  @ApiProperty({ type: Number, description: 'Cents, the running balance at the end of December (or, for a deleted cashbox, at its last active month).' })
  closingBalance!: number;

  @ApiProperty({ type: CashboxesReportMonthDto, isArray: true, description: 'Twelve entries, index 0 = January.' })
  months!: CashboxesReportMonthDto[];
}

/**
 * `GET /api/reports/cashboxes` (M6-T05, #185) — the evolution panel `/reports` shows apart from the
 * expense charts, since cashbox movement is excluded from expense reports by construction
 * (`AGENTS.md` domain rules). Grouped by `referenceMonth`, `status = CONFIRMED` only, same as every
 * other report. A live cashbox with no activity in the requested year still appears, carrying its
 * opening balance across all twelve months; a deleted one only appears if it has any confirmed
 * history at all, and its row ends at its last active month.
 */
export class CashboxesReportDto {
  @ApiProperty({ type: Number, example: 2026 })
  year!: number;

  @ApiProperty({ type: CashboxesReportCashboxDto, isArray: true })
  cashboxes!: CashboxesReportCashboxDto[];
}

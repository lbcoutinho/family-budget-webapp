import { ApiProperty } from '@nestjs/swagger';

import { CategoryKind } from '../../../generated/prisma/client';

class MonthlyReportSubcategoryDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '`null` for the amount with no subcategory chosen.' })
  subcategoryId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '`null` when `subcategoryId` is `null`.' })
  name!: string | null;

  @ApiProperty({ type: Number, description: 'Cents.' })
  amount!: number;

  @ApiProperty({ type: Number, description: 'Of the parent category row, 2 decimals, rounding handled so the set sums to 100.00.' })
  percentage!: number;
}

class MonthlyReportCategoryDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '`null` for the uncategorized bucket.' })
  categoryId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '`null` when `categoryId` is `null`.' })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  color!: string | null;

  @ApiProperty({ enum: CategoryKind, enumName: 'CategoryKind', description: 'Which side of the report this row belongs to.' })
  kind!: CategoryKind;

  @ApiProperty({ type: Number, description: 'Cents.' })
  amount!: number;

  @ApiProperty({ type: Number, description: "Of this row's own side (income or expense) total, 2 decimals, sums to 100.00 within that side." })
  percentage!: number;

  @ApiProperty({ type: Number, description: 'Cents, rounded. Sum over the twelve months ending with the requested one, divided by the months with movement.' })
  rollingAverage!: number;

  @ApiProperty({ type: MonthlyReportSubcategoryDto, isArray: true })
  subcategories!: MonthlyReportSubcategoryDto[];
}

class MonthlyReportCashboxItemDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: '`null` when the cashbox was since deleted (ADR-0019); `name` still carries its label.',
  })
  cashboxId!: string | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_IN plus the CASHBOX_TRANSFER received.' })
  deposits!: number;

  @ApiProperty({ type: Number, description: 'Cents, CASHBOX_OUT plus the CASHBOX_TRANSFER sent.' })
  withdrawals!: number;

  @ApiProperty({ type: Number, description: 'Cents, deposits minus withdrawals.' })
  balance!: number;
}

class MonthlyReportCashboxesDto {
  @ApiProperty({ type: MonthlyReportCashboxItemDto, isArray: true })
  items!: MonthlyReportCashboxItemDto[];

  @ApiProperty({ type: Number, description: 'Cents.' })
  depositsTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents.' })
  withdrawalsTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents, depositsTotal minus withdrawalsTotal.' })
  balance!: number;
}

/**
 * `GET /api/reports/monthly` (M6-T01). Excludes TRANSFER and every CASHBOX_* type by construction —
 * the cashbox block below is informational only, and is not part of `incomeTotal`/`expenseTotal`.
 */
export class MonthlyReportDto {
  @ApiProperty({ type: Number, example: 2026 })
  year!: number;

  @ApiProperty({ type: Number, example: 3 })
  month!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of INCOME over the month.' })
  incomeTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of EXPENSE over the month.' })
  expenseTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents, incomeTotal minus expenseTotal.' })
  balance!: number;

  @ApiProperty({ type: MonthlyReportCategoryDto, isArray: true, description: 'Categories with no activity in the month are omitted.' })
  categories!: MonthlyReportCategoryDto[];

  @ApiProperty({ type: MonthlyReportCashboxesDto })
  cashboxes!: MonthlyReportCashboxesDto;
}

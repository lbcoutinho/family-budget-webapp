import { ApiProperty, OmitType } from '@nestjs/swagger';

import { CategoryKind } from '../../../generated/prisma/client';

class YearlyReportMonthDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 })
  month!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of INCOME for this month.' })
  income!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of EXPENSE for this month.' })
  expense!: number;

  @ApiProperty({ type: Number, description: 'Cents, income minus expense.' })
  balance!: number;
}

class YearlyReportTotalsDto {
  @ApiProperty({ type: Number, description: 'Cents.' })
  income!: number;

  @ApiProperty({ type: Number, description: 'Cents.' })
  expense!: number;

  @ApiProperty({ type: Number, description: 'Cents, income minus expense.' })
  balance!: number;
}

class YearlyReportAverageWindowDto {
  @ApiProperty({ type: String, format: 'date', description: 'Inclusive start of the 12-month window `monthlyAverage` is computed over.' })
  from!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    description: 'Inclusive end of the window — `min(December of the requested year, the current reference month)`.',
  })
  to!: string;
}

class YearlyReportSubcategoryDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '`null` for the amount with no subcategory chosen.' })
  subcategoryId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '`null` when `subcategoryId` is `null`.' })
  name!: string | null;

  @ApiProperty({ type: Number, isArray: true, description: 'Cents, 12 entries, index 0 = January. Zero for a month with no activity.' })
  monthly!: number[];

  @ApiProperty({ type: Number, description: 'Cents, sum of `monthly` — the row total.' })
  total!: number;
}

class YearlyReportCategoryDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '`null` for the uncategorized bucket.' })
  categoryId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '`null` when `categoryId` is `null`.' })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  color!: string | null;

  @ApiProperty({ enum: CategoryKind, enumName: 'CategoryKind', description: 'Which side of the report this row belongs to.' })
  kind!: CategoryKind;

  @ApiProperty({ type: Number, isArray: true, description: 'Cents, 12 entries, index 0 = January. Zero for a month with no activity.' })
  monthly!: number[];

  @ApiProperty({ type: Number, description: 'Cents, sum of `monthly` — the row total.' })
  total!: number;

  @ApiProperty({
    type: Number,
    description:
      'Cents, rounded. Sum over `averageWindow`, divided by the months in it with movement — not `total / 12`. For a past, complete year this equals the ' +
      'average of the row above; for the current year the window reaches into the prior year, so it will not reconcile with `total / 12`.',
  })
  monthlyAverage!: number;

  @ApiProperty({ type: YearlyReportSubcategoryDto, isArray: true, description: 'Rolled up into this row already; empty when the category has none.' })
  subcategories!: YearlyReportSubcategoryDto[];
}

/**
 * `YearlyReportCategoryDto` minus `monthlyAverage` and `subcategories` — the query range for
 * `?compare=true` only fetches the prior year's own twelve months, not a further rolling window
 * behind it, so a genuine rolling average isn't available for the comparison year, and the
 * comparison never drives its own expandable rows (`10-reports-yearly.html`).
 */
class YearlyReportComparisonCategoryDto extends OmitType(YearlyReportCategoryDto, ['monthlyAverage', 'subcategories'] as const) {}

class YearlyReportComparisonDto {
  @ApiProperty({ type: Number, example: 2025 })
  year!: number;

  @ApiProperty({ type: YearlyReportMonthDto, isArray: true })
  months!: YearlyReportMonthDto[];

  @ApiProperty({ type: YearlyReportComparisonCategoryDto, isArray: true })
  categories!: YearlyReportComparisonCategoryDto[];

  @ApiProperty({ type: YearlyReportTotalsDto })
  totals!: YearlyReportTotalsDto;
}

/**
 * `GET /api/reports/yearly` (M6-T02, #182). Same exclusions as the monthly report: only
 * `INCOME`/`EXPENSE` and `status = CONFIRMED`, grouped by `referenceMonth`. Categories with no
 * activity anywhere in the requested year are omitted; months with no activity are still present
 * as zero cells.
 */
export class YearlyReportDto {
  @ApiProperty({ type: Number, example: 2026 })
  year!: number;

  @ApiProperty({ type: YearlyReportAverageWindowDto, description: 'Names the window `monthlyAverage` measures, so the UI can label the column.' })
  averageWindow!: YearlyReportAverageWindowDto;

  @ApiProperty({ type: YearlyReportMonthDto, isArray: true, description: 'Twelve entries — the matrix column totals.' })
  months!: YearlyReportMonthDto[];

  @ApiProperty({ type: YearlyReportCategoryDto, isArray: true })
  categories!: YearlyReportCategoryDto[];

  @ApiProperty({ type: YearlyReportTotalsDto })
  totals!: YearlyReportTotalsDto;

  @ApiProperty({ type: YearlyReportComparisonDto, required: false, description: 'Present only when `?compare=true`.' })
  comparison?: YearlyReportComparisonDto;
}

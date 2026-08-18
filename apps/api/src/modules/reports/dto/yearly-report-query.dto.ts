import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query string of `GET /api/reports/yearly`. */
export class YearlyReportQueryDto {
  @ApiProperty({ type: Number, example: 2026, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ type: Boolean, required: false, default: false, description: 'Includes the prior year under `comparison`.' })
  // Same explicit `'true'` string compare as `ListTransactionsQueryDto#isCreditCard`: a query string
  // never carries an actual boolean, and `ValidationPipe`'s `transform` would coerce any non-empty
  // string — including `'false'` — to `true` otherwise.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  @IsOptional()
  @IsBoolean()
  compare?: boolean;
}

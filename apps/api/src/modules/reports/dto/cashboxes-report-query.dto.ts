import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Query string of `GET /api/reports/cashboxes`. */
export class CashboxesReportQueryDto {
  @ApiProperty({ type: Number, example: 2026, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

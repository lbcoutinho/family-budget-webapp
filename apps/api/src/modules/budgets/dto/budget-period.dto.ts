import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BudgetPeriodDto {
  @ApiProperty({ type: Number, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;
}

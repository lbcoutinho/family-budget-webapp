import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class ListInvestmentFlowQueryDto {
  @ApiProperty({ type: Number, example: 2026 })
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(2000)
  @Max(9999)
  year!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from 'class-validator';

import { PutBudgetAllocationDto } from './put-budget-allocation.dto';

export class PutBudgetDto {
  @ApiProperty({ type: Number, minimum: 1, description: 'Estimated quarterly Income in integer cents.' })
  @IsInt()
  @IsPositive()
  estimatedQuarterlyIncome!: number;

  @ApiProperty({ type: String, required: false, nullable: true, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @ApiProperty({ type: () => [PutBudgetAllocationDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PutBudgetAllocationDto)
  allocations?: PutBudgetAllocationDto[];
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

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
}

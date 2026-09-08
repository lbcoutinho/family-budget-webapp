import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PutBudgetAllocationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100, multipleOf: 0.01 })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  targetPercentage!: number;

  @ApiProperty({ type: Number, minimum: 0, description: 'Effective monthly target in integer cents.' })
  @IsInt()
  @Min(0)
  adjustedMonthlyAmount!: number;

  @ApiProperty({ type: String, required: false, nullable: true, maxLength: 2000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsDecimal, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePositionAdjustmentDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() accountId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() instrumentId!: string;
  @ApiProperty({ type: String, example: '-0.001', description: 'Signed exact quantity.' })
  @IsDecimal({ decimal_digits: '0,18', force_decimal: false })
  quantity!: string;
  @ApiPropertyOptional({ type: Number, example: 710, description: 'EUR cost in integer cents; required for a positive quantity.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cost?: number;
  @ApiProperty({ type: String, format: 'date-time' }) @IsDateString() effectiveAt!: string;
  @ApiProperty({ type: String, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

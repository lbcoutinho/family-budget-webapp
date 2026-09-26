import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsDecimal, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBalanceAdjustmentDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() accountId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() instrumentId!: string;
  @ApiProperty({ type: String, example: '-15', description: 'Signed exact quantity.' })
  @IsDecimal({ decimal_digits: '0,18', force_decimal: false })
  quantity!: string;
  @ApiProperty({ type: String, format: 'date-time' }) @IsDateString() effectiveAt!: string;
  @ApiProperty({ type: String, maxLength: 1000 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

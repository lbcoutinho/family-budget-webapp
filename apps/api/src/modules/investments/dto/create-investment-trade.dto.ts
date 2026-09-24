import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsDecimal, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateInvestmentTradeDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() accountId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() acquiredInstrumentId!: string;
  @ApiProperty({ type: String, example: '0.123456789012345678', description: 'Exact received quantity.' })
  @IsDecimal({ decimal_digits: '0,18', force_decimal: false })
  acquiredQuantity!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() disposedInstrumentId!: string;
  @ApiProperty({ type: String, example: '500', description: 'Exact delivered quantity.' })
  @IsDecimal({ decimal_digits: '0,18', force_decimal: false })
  disposedQuantity!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) @IsOptional() @IsUUID() feeInstrumentId?: string;
  @ApiPropertyOptional({ type: String, example: '0.001', description: 'Exact fee quantity.' })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,18', force_decimal: false })
  feeQuantity?: string;
  @ApiPropertyOptional({ type: Number, example: 100, description: 'EUR fee value at execution, in integer cents.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  feeValue?: number;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) @IsOptional() @IsUUID() assetListingId?: string;
  @ApiProperty({ type: String, format: 'date-time', example: '2026-09-23T10:30:00.000Z', description: 'UTC execution instant.' })
  @IsDateString()
  executedAt!: string;
  @ApiProperty({ type: Number, example: 50000, description: 'EUR equivalent at execution, in integer cents.' }) @IsInt() @Min(1) executionValue!: number;
  @ApiPropertyOptional({ type: String, maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

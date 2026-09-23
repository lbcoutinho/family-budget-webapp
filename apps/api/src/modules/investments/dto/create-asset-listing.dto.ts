import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAssetListingDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() instrumentId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() quoteInstrumentId!: string;
  @ApiProperty({ type: String, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  market!: string;
  @ApiProperty({ type: String, maxLength: 40 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  ticker!: string;
  @ApiPropertyOptional({ type: String, maxLength: 12 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;
  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerSymbol?: string;
  @ApiProperty({ type: Number, required: false, default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

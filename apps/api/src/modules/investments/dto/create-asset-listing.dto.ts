import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAssetListingDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() instrumentId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() quoteInstrumentId!: string;
  @ApiProperty({ type: String, maxLength: 80, example: 'XETRA', description: 'Market venue, for example XETRA or Kraken.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  market!: string;
  @ApiProperty({ type: String, maxLength: 40, example: 'VWCE', description: 'Venue asset or pair code, for example VWCE or BTC-EUR.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  ticker!: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 12,
    example: 'IE00BK5BQT80',
    description: 'Security identifier. Native cryptocurrencies normally have no ISIN.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;
  @ApiPropertyOptional({
    type: String,
    maxLength: 120,
    example: 'VWCE.XETRA',
    description: 'Optional quote-provider identifier, for example VWCE.XETRA or BTC-EUR.CC.',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerSymbol?: string;
  @ApiProperty({ type: Number, required: false, default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

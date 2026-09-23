import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssetListingDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) instrumentId!: string;
  @ApiProperty({ type: String }) instrumentName!: string;
  @ApiProperty({ type: String, format: 'uuid' }) quoteInstrumentId!: string;
  @ApiProperty({ type: String }) quoteInstrumentCode!: string;
  @ApiProperty({ type: String }) market!: string;
  @ApiProperty({ type: String }) ticker!: string;
  @ApiPropertyOptional({ type: String }) isin!: string | null;
  @ApiPropertyOptional({ type: String }) providerSymbol!: string | null;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

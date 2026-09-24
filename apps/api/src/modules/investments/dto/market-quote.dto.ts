import { ApiProperty } from '@nestjs/swagger';

export class MarketQuoteDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) assetListingId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) quoteInstrumentId!: string;
  @ApiProperty({ type: String }) quoteInstrumentCode!: string;
  @ApiProperty({ type: String }) price!: string;
  @ApiProperty({ type: String, format: 'date' }) marketDate!: string;
  @ApiProperty({ enum: ['MANUAL'] }) source!: 'MANUAL';
  @ApiProperty({ enum: ['VALID'] }) status!: 'VALID';
}

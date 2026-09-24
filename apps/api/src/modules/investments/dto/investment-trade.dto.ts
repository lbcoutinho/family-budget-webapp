import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvestmentTradeDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) accountId!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String, format: 'uuid' }) acquiredInstrumentId!: string;
  @ApiProperty({ type: String }) acquiredInstrumentName!: string;
  @ApiProperty({ type: String }) acquiredInstrumentCode!: string;
  @ApiProperty({ type: Number }) acquiredDisplayPrecision!: number;
  @ApiProperty({ type: String }) acquiredQuantity!: string;
  @ApiProperty({ type: String, format: 'uuid' }) disposedInstrumentId!: string;
  @ApiProperty({ type: String }) disposedInstrumentName!: string;
  @ApiProperty({ type: String }) disposedInstrumentCode!: string;
  @ApiProperty({ type: Number }) disposedDisplayPrecision!: number;
  @ApiProperty({ type: String }) disposedQuantity!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid' }) assetListingId!: string | null;
  @ApiPropertyOptional({ type: String }) assetListing!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) executedAt!: string;
  @ApiProperty({ type: Number, description: 'EUR equivalent at execution, in integer cents.' }) executionValue!: number;
  @ApiProperty({ type: String, description: 'Delivered quantity per acquired unit, to 12 decimal places.' }) executionPrice!: string;
  @ApiPropertyOptional({ type: String }) notes!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsDecimal, IsUUID } from 'class-validator';

export class CreateMarketQuoteDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID() assetListingId!: string;
  @ApiProperty({ type: String, example: '132.456789012345', description: 'Exact price in the listing quote instrument.' })
  @IsDecimal({ decimal_digits: '0,12', force_decimal: false })
  price!: string;
  @ApiProperty({ type: String, format: 'date' }) @IsDateString() marketDate!: string;
}

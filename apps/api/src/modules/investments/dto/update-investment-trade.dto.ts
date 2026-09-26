import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsDecimal, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

import { CreateInvestmentTradeDto } from './create-investment-trade.dto';

export class UpdateInvestmentTradeDto extends OmitType(CreateInvestmentTradeDto, [
  'feeInstrumentId',
  'feeQuantity',
  'feeValue',
  'assetListingId',
  'notes',
] as const) {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) @IsOptional() @IsUUID() declare feeInstrumentId?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) @IsOptional() @IsDecimal({ decimal_digits: '0,18', force_decimal: false }) declare feeQuantity?:
    string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) @IsOptional() @IsInt() @Min(1) declare feeValue?: number | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) @IsOptional() @IsUUID() declare assetListingId?: string | null;
  @ApiPropertyOptional({ type: String, maxLength: 1000, nullable: true }) @IsOptional() @IsString() @MaxLength(1000) declare notes?: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InvestmentTradeDto } from './investment-trade.dto';

export class InvestmentFundingDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'date' }) date!: string;
  @ApiProperty({ type: String }) sourceAccountName!: string;
  @ApiProperty({ type: String }) destinationAccountName!: string;
  @ApiProperty({ type: Number, description: 'EUR amount in integer cents.' }) amount!: number;
}

export class InvestmentFlowDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 12 }) month!: number;
  @ApiProperty({ type: Number, description: 'EUR amount in integer cents.' }) investmentPurchaseAmount!: number;
  @ApiProperty({ type: Number, description: 'EUR amount in integer cents.' }) netSales!: number;
  @ApiProperty({ type: Number, description: 'EUR amount in integer cents.' }) netInvestmentFlow!: number;
  @ApiProperty({ type: Number, description: 'EUR amount in integer cents.' }) tradeFees!: number;
  @ApiProperty({ type: Number, description: 'EUR amount in integer cents.' }) realizedResult!: number;
  @ApiProperty({ type: [InvestmentTradeDto] }) trades!: InvestmentTradeDto[];
  @ApiPropertyOptional({ type: [InvestmentFundingDto] }) fundingTransfers!: InvestmentFundingDto[];
}

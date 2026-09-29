import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean } from 'class-validator';

import { AccountInstrumentBalanceDto } from '../../accounts/dto/account-instrument-balance.dto';

import { InvestmentPositionDto } from './investment-position.dto';

export class InvestmentImportPreviewErrorDto {
  @ApiProperty({ type: Number }) line!: number;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) message!: string;
}

export class InvestmentImportPreviewBalanceDto {
  @ApiProperty({ type: String, format: 'uuid' }) accountId!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String, format: 'uuid' }) instrumentId!: string;
  @ApiProperty({ type: String }) instrumentCode!: string;
  @ApiProperty({ type: String }) quantity!: string;
}

export class InvestmentImportPreviewPositionDto {
  @ApiProperty({ type: String, format: 'uuid' }) accountId!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String, format: 'uuid' }) instrumentId!: string;
  @ApiProperty({ type: String }) instrumentCode!: string;
  @ApiProperty({ type: String }) quantity!: string;
  @ApiProperty({ type: Number }) remainingCost!: number;
  @ApiProperty({ type: Number }) realizedResult!: number;
}

export class InvestmentImportPreviewDto {
  @ApiProperty({ type: Number }) validRows!: number;
  @ApiProperty({ type: [InvestmentImportPreviewErrorDto] }) errors!: InvestmentImportPreviewErrorDto[];
  @ApiProperty({ type: [InvestmentImportPreviewErrorDto] }) warnings!: InvestmentImportPreviewErrorDto[];
  @ApiProperty({ type: [InvestmentImportPreviewBalanceDto] }) balances!: InvestmentImportPreviewBalanceDto[];
  @ApiProperty({ type: [InvestmentImportPreviewPositionDto] }) positions!: InvestmentImportPreviewPositionDto[];
}

export class InvestmentImportConfirmationDto {
  @ApiProperty({ type: String, format: 'uuid' }) batchId!: string;
  @ApiProperty({ type: Number }) importedRows!: number;
}

export class InvestmentImportRollbackTradeDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) executedAt!: string;
}

export class InvestmentImportRollbackAdjustmentDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: String }) reason!: string;
}

export class InvestmentImportRollbackPreviewDto {
  @ApiProperty({ type: [InvestmentImportRollbackTradeDto] }) importedTrades!: InvestmentImportRollbackTradeDto[];
  @ApiProperty({ type: [InvestmentImportRollbackTradeDto] }) laterTrades!: InvestmentImportRollbackTradeDto[];
  @ApiProperty({ type: [InvestmentImportRollbackAdjustmentDto] }) laterPositionAdjustments!: InvestmentImportRollbackAdjustmentDto[];
  @ApiProperty({ type: [InvestmentImportRollbackAdjustmentDto] }) laterBalanceAdjustments!: InvestmentImportRollbackAdjustmentDto[];
  @ApiProperty({ type: [InvestmentPositionDto] }) projectedPositions!: InvestmentPositionDto[];
  @ApiProperty({ type: [AccountInstrumentBalanceDto] }) projectedBalances!: AccountInstrumentBalanceDto[];
}

export class RollbackInvestmentImportDto {
  @ApiProperty({ enum: [true] })
  @IsBoolean()
  @Equals(true)
  confirm!: true;
}

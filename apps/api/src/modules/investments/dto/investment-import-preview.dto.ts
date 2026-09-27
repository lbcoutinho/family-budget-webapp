import { ApiProperty } from '@nestjs/swagger';

export class InvestmentImportPreviewErrorDto {
  @ApiProperty({ type: Number }) line!: number;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String }) message!: string;
}

export class InvestmentImportPreviewBalanceDto {
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String }) instrumentCode!: string;
  @ApiProperty({ type: String }) quantity!: string;
}

export class InvestmentImportPreviewPositionDto {
  @ApiProperty({ type: String }) accountName!: string;
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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InstrumentType } from '../../../generated/prisma/client';

export class InvestmentPositionDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) accountId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) accountName!: string | null;
  @ApiProperty({ type: String, format: 'uuid' }) instrumentId!: string;
  @ApiProperty({ type: String }) instrumentName!: string;
  @ApiProperty({ type: String }) instrumentCode!: string;
  @ApiProperty({ enum: InstrumentType, enumName: 'InstrumentType' }) instrumentType!: InstrumentType;
  @ApiProperty({ type: Number }) displayPrecision!: number;
  @ApiProperty({ type: String, description: 'Exact quantity.' }) quantity!: string;
  @ApiProperty({ type: Number, description: 'Remaining EUR cost, in integer cents.' }) remainingCost!: number;
  @ApiProperty({ type: String, description: 'Remaining EUR cost per unit, to 12 decimal places.' }) weightedAverageCost!: string;
  @ApiProperty({ type: Number, description: 'Realized EUR result, in integer cents.' }) realizedResult!: number;
}

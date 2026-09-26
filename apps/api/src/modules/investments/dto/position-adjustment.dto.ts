import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PositionAdjustmentDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) accountId!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ type: String, format: 'uuid' }) instrumentId!: string;
  @ApiProperty({ type: String }) instrumentCode!: string;
  @ApiProperty({ type: String }) quantity!: string;
  @ApiPropertyOptional({ type: Number, description: 'EUR cost in integer cents.' }) cost!: number | null;
  @ApiProperty({ type: String, format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

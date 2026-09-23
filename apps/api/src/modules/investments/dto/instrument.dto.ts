import { ApiProperty } from '@nestjs/swagger';

import { InstrumentType } from '../../../generated/prisma/client';
export class InstrumentDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ enum: InstrumentType, enumName: 'InstrumentType' }) type!: InstrumentType;
  @ApiProperty({ type: Number, minimum: 0, maximum: 18 }) displayPrecision!: number;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

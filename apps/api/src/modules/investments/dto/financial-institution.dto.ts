import { ApiProperty } from '@nestjs/swagger';

import { FinancialInstitutionKind } from '../../../generated/prisma/client';

export class FinancialInstitutionDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: FinancialInstitutionKind, enumName: 'FinancialInstitutionKind' }) kind!: FinancialInstitutionKind;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: Number }) sortOrder!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

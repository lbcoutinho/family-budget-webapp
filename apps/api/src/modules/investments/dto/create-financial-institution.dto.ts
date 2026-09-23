import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { FinancialInstitutionKind } from '../../../generated/prisma/client';

export class CreateFinancialInstitutionDto {
  @ApiProperty({ type: String, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
  @ApiProperty({ enum: FinancialInstitutionKind, enumName: 'FinancialInstitutionKind' }) @IsEnum(FinancialInstitutionKind) kind!: FinancialInstitutionKind;
  @ApiProperty({ type: Number, required: false, default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

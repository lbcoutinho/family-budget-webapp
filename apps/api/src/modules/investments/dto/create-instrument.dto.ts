import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { InstrumentType } from '../../../generated/prisma/client';
export class CreateInstrumentDto {
  @ApiProperty({ type: String, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
  @ApiProperty({ type: String, maxLength: 20 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;
  @ApiProperty({ enum: InstrumentType, enumName: 'InstrumentType' }) @IsEnum(InstrumentType) type!: InstrumentType;
  @ApiProperty({ type: Number, minimum: 0, maximum: 18, required: false, default: 2 }) @IsOptional() @IsInt() @Min(0) @Max(18) displayPrecision?: number;
  @ApiProperty({ type: Number, required: false, default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

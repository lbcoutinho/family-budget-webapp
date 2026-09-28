import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFinancialInstitutionDto {
  @ApiProperty({ type: String, maxLength: 80 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
  @ApiProperty({ type: Number, required: false, default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

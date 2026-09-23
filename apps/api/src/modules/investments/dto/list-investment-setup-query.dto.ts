import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ListInvestmentSetupQueryDto {
  @ApiProperty({ type: Boolean, required: false, default: false })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

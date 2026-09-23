import { ApiProperty } from '@nestjs/swagger';
import { IsDecimal, IsUUID } from 'class-validator';

export class CreateAccountInitialBalanceDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  instrumentId!: string;

  @ApiProperty({ type: String, example: '0.123456789012345678', description: 'Exact native Instrument quantity.' })
  @IsDecimal({ decimal_digits: '0,18', force_decimal: false })
  quantity!: string;
}

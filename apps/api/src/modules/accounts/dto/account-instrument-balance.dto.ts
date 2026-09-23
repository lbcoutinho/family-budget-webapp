import { ApiProperty } from '@nestjs/swagger';

/** One exact native Instrument quantity held by an Account. */
export class AccountInstrumentBalanceDto {
  @ApiProperty({ type: String, format: 'uuid' })
  accountId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  instrumentId!: string;

  @ApiProperty({ type: String, example: '0.123456789012345678', description: 'Exact native Instrument quantity.' })
  quantity!: string;

  @ApiProperty({ type: String, example: 'Bitcoin' })
  instrumentName!: string;

  @ApiProperty({ type: String, example: 'BTC' })
  instrumentCode!: string;
}

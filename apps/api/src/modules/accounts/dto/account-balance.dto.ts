import { ApiProperty } from '@nestjs/swagger';

/** Response row of `GET /accounts/balances` (M4-T07, #104). Every `@ApiProperty` states its `type` for the same reason as `AccountDto`. */
export class AccountBalanceDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  accountId!: string;

  @ApiProperty({ type: String, example: 'Millennium' })
  name!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: Number, example: 150_000, description: 'Balance before the first recorded transaction, in **cents** (ADR-0005).' })
  initialBalance!: number;

  @ApiProperty({
    type: Number,
    example: 182_400,
    description: 'initialBalance + INCOME − EXPENSE − CASHBOX_IN + CASHBOX_OUT + TRANSFER(destination) − TRANSFER(source), in **cents**.',
  })
  balance!: number;
}

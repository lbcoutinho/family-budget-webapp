import { ApiProperty } from '@nestjs/swagger';

/** Response row of `GET /cashboxes/balances` (M4-T07, #104). Every `@ApiProperty` states its `type` for the same reason as `CashboxDto`. */
export class CashboxBalanceDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  cashboxId!: string;

  @ApiProperty({ type: String, example: 'Fundo de emergência' })
  name!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 500_000,
    description: 'Goal the cashbox draws progress against, in **cents** (ADR-0005). Null means it simply accumulates.',
  })
  targetAmount!: number | null;

  @ApiProperty({
    type: Number,
    example: 6_000,
    description: 'CASHBOX_IN − CASHBOX_OUT + CASHBOX_TRANSFER(destination) − CASHBOX_TRANSFER(source), in **cents**.',
  })
  balance!: number;
}

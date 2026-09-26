import { ApiProperty } from '@nestjs/swagger';

import { AccountInstrumentBalanceDto } from '../../accounts/dto/account-instrument-balance.dto';

import { InvestmentPositionDto } from './investment-position.dto';
import { InvestmentTradeDto } from './investment-trade.dto';

export class InvestmentTradeRemovalPreviewDto {
  @ApiProperty({ type: [InvestmentTradeDto], description: 'Later operations that will be replayed after removal.' })
  laterTrades!: InvestmentTradeDto[];
  @ApiProperty({ type: [InvestmentPositionDto], description: 'Positions and results after replaying history without the removed trade.' })
  projectedPositions!: InvestmentPositionDto[];
  @ApiProperty({ type: [AccountInstrumentBalanceDto], description: 'Affected Instrument Balances after removing the trade.' })
  projectedBalances!: AccountInstrumentBalanceDto[];
}

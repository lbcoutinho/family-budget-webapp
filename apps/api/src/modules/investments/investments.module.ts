import { Module } from '@nestjs/common';

import { TransactionsModule } from '../transactions/transactions.module';

import { AssetListingsController, FinancialInstitutionsController, InstrumentsController, InvestmentTradesController } from './investments.controller';
import { InvestmentsService } from './investments.service';

@Module({
  imports: [TransactionsModule],
  controllers: [FinancialInstitutionsController, InstrumentsController, AssetListingsController, InvestmentTradesController],
  providers: [InvestmentsService],
})
export class InvestmentsModule {}

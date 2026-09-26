import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { TransactionsModule } from '../transactions/transactions.module';

import { EodhdQuoteProvider, MARKET_QUOTE_PROVIDER } from './eodhd-quote.provider';
import {
  AssetListingsController,
  FinancialInstitutionsController,
  InstrumentsController,
  InvestmentFlowsController,
  InvestmentPositionsController,
  InvestmentTradesController,
  MarketQuotesController,
} from './investments.controller';
import { InvestmentsService } from './investments.service';
import { MarketQuoteSyncInterceptor } from './market-quote-sync.interceptor';

@Module({
  imports: [TransactionsModule],
  controllers: [
    FinancialInstitutionsController,
    InstrumentsController,
    AssetListingsController,
    InvestmentTradesController,
    InvestmentFlowsController,
    MarketQuotesController,
    InvestmentPositionsController,
  ],
  providers: [
    InvestmentsService,
    EodhdQuoteProvider,
    { provide: MARKET_QUOTE_PROVIDER, useExisting: EodhdQuoteProvider },
    { provide: APP_INTERCEPTOR, useClass: MarketQuoteSyncInterceptor },
  ],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}

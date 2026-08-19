import { Module } from '@nestjs/common';

import { BalancesService } from './balances.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionValidator } from './validators/transaction-validator';

/**
 * `PrismaModule` is global, so nothing needs importing here. `BalancesService` is exported so
 * `AccountsModule`/`CashboxesModule` (M4-T07, #104) can inject it for their `balances` endpoints
 * without either module depending on the other. `TransactionValidator` is exported so
 * `RecurrenceModule` (M7-T03) can reuse the same per-type reference rules instead of duplicating
 * them.
 */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionValidator, BalancesService],
  exports: [BalancesService, TransactionValidator],
})
export class TransactionsModule {}

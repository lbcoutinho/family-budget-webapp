import { Module } from '@nestjs/common';

import { TransactionsModule } from '../transactions/transactions.module';

import { CashboxesController } from './cashboxes.controller';
import { CashboxesService } from './cashboxes.service';

/** `PrismaModule` is global, so nothing needs importing here. `TransactionsModule` is imported for its exported `BalancesService` (M4-T07, #104). */
@Module({
  imports: [TransactionsModule],
  controllers: [CashboxesController],
  providers: [CashboxesService],
})
export class CashboxesModule {}

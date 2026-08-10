import { Module } from '@nestjs/common';

import { TransactionsModule } from '../transactions/transactions.module';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

/** `PrismaModule` is global, so nothing needs importing here. `TransactionsModule` is imported for its exported `BalancesService` (M4-T07, #104). */
@Module({
  imports: [TransactionsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}

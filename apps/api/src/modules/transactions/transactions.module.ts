import { Module } from '@nestjs/common';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionValidator } from './validators/transaction-validator';

/** `PrismaModule` is global, so nothing needs importing here. */
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionValidator],
})
export class TransactionsModule {}

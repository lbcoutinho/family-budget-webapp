import { Module } from '@nestjs/common';

import { TransactionsModule } from '../transactions/transactions.module';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** `PrismaModule` is global, so nothing needs importing here (M6-T01). `TransactionsModule` is imported for its exported `BalancesService` (M6-T05, #185). */
@Module({
  imports: [TransactionsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

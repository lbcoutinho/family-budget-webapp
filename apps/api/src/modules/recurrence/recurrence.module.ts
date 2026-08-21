import { Module } from '@nestjs/common';

import { TransactionsModule } from '../transactions/transactions.module';

import { InstallmentsService } from './installments.service';
import { RecurrenceCatchUpService } from './recurrence-catch-up.service';
import { RecurrenceGeneratorService } from './recurrence-generator.service';
import { RecurrenceRulesController } from './recurrence-rules.controller';
import { RecurrenceRulesService } from './recurrence-rules.service';

/**
 * `PrismaModule` is global, so nothing needs importing here. `TransactionsModule` is imported for
 * its exported `TransactionValidator`, which `RecurrenceRulesService` and `InstallmentsService`
 * (M7-T04) reuse for cross-field reference validation. `RecurrenceGeneratorService` and
 * `RecurrenceCatchUpService` stay exported so a future long-running deployment could reuse
 * `runForUser` from a scheduler unchanged (#199).
 */
@Module({
  imports: [TransactionsModule],
  controllers: [RecurrenceRulesController],
  providers: [RecurrenceGeneratorService, RecurrenceRulesService, InstallmentsService, RecurrenceCatchUpService],
  exports: [RecurrenceGeneratorService, RecurrenceCatchUpService],
})
export class RecurrenceModule {}

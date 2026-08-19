import { Module } from '@nestjs/common';

import { TransactionsModule } from '../transactions/transactions.module';

import { RecurrenceGeneratorService } from './recurrence-generator.service';
import { RecurrenceRulesController } from './recurrence-rules.controller';
import { RecurrenceRulesService } from './recurrence-rules.service';

/**
 * `PrismaModule` is global, so nothing needs importing here. `TransactionsModule` is imported for
 * its exported `TransactionValidator`, which `RecurrenceRulesService` reuses for cross-field
 * reference validation (M7-T03). `RecurrenceGeneratorService` stays exported for #199 (the
 * scheduled generation job).
 */
@Module({
  imports: [TransactionsModule],
  controllers: [RecurrenceRulesController],
  providers: [RecurrenceGeneratorService, RecurrenceRulesService],
  exports: [RecurrenceGeneratorService],
})
export class RecurrenceModule {}

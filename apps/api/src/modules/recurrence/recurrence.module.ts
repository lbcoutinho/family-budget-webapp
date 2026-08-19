import { Module } from '@nestjs/common';

import { RecurrenceGeneratorService } from './recurrence-generator.service';

/**
 * `PrismaModule` is global, so nothing needs importing here. No controller yet — #197 adds CRUD/
 * preview/manual-generation endpoints on top of `RecurrenceGeneratorService`, exported so #197/#199
 * can inject it without a controller-to-controller dependency.
 */
@Module({
  providers: [RecurrenceGeneratorService],
  exports: [RecurrenceGeneratorService],
})
export class RecurrenceModule {}

import { Module } from '@nestjs/common';

import { CashboxesController } from './cashboxes.controller';
import { CashboxesService } from './cashboxes.service';

/** `PrismaModule` is global, so nothing needs importing here. */
@Module({
  controllers: [CashboxesController],
  providers: [CashboxesService],
})
export class CashboxesModule {}

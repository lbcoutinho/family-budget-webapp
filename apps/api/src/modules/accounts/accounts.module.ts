import { Module } from '@nestjs/common';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

/** `PrismaModule` is global, so nothing needs importing here. */
@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}

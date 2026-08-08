import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** `PrismaModule` is global, so nothing needs importing here. */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

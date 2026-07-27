import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

/**
 * Thin wrapper around the generated Prisma client, managed by Nest's lifecycle. Connects on
 * module init (fail-fast: a bad `DATABASE_URL` surfaces at boot, not on the first query) and
 * disconnects cleanly on shutdown so the process does not hang on open pool connections.
 *
 * Prisma 7 ships no built-in database driver (ADR-0017), so the connection is handed to the
 * client as a `pg` adapter. The URL comes from `ConfigService`, which means it has been through
 * the boot-time env validation (M1-T03) instead of being read straight off `process.env`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL') }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

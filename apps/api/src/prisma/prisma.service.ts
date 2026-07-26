import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around the generated Prisma client, managed by Nest's lifecycle. Connects on
 * module init (fail-fast: a bad `DATABASE_URL` surfaces at boot, not on the first query) and
 * disconnects cleanly on shutdown so the process does not hang on open pool connections.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

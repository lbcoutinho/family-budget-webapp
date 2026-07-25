import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/** Shape returned by `GET /api/health`. */
export interface HealthStatus {
  status: 'ok';
  db: 'up';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness of the API plus a real round-trip to the database (`SELECT 1`). A reachable process
   * with an unreachable database is not healthy, so a failed query answers 503 rather than 200.
   */
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Health check failed: database unreachable', error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }

    return { status: 'ok', db: 'up' };
  }
}

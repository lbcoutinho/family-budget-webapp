import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { RecurrenceCatchUpFailureDto } from './dto/recurrence-catch-up-failure.dto';
import { RecurrenceCatchUpResultDto } from './dto/recurrence-catch-up-result.dto';
import { ROLLING_HORIZON_MONTHS, rollingHorizon } from './horizon';
import { RecurrenceGeneratorService } from './recurrence-generator.service';

/**
 * Arbitrary first argument to `pg_try_advisory_lock(namespace, key)` (ADR-0014 territory, #199).
 * Keeps this feature's per-user locks in their own namespace, out of the way of any other
 * advisory lock this codebase ever grows.
 */
const LOCK_NAMESPACE = 199_00;

/**
 * Login-triggered catch-up (#199): a whole user's active rules, generated up to the same rolling
 * horizon `POST /:id/generate` uses (`horizon.ts`), with an advisory lock so a second tab logging
 * in at the same moment cannot race a run already in flight. Orchestration only — occurrence math
 * and idempotency stay entirely `RecurrenceGeneratorService`'s concern (#196).
 */
@Injectable()
export class RecurrenceCatchUpService {
  private readonly logger = new Logger(RecurrenceCatchUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: RecurrenceGeneratorService,
  ) {}

  async runForUser(userId: string): Promise<RecurrenceCatchUpResultDto> {
    const locked = await this.tryLock(userId);

    if (!locked) {
      this.logger.warn({ msg: 'Recurrence catch-up skipped: already running for this user', userId });
      return { rulesProcessed: 0, created: 0, failed: [], skippedLocked: true };
    }

    try {
      return await this.runLocked(userId);
    } finally {
      await this.unlock(userId);
    }
  }

  private async runLocked(userId: string): Promise<RecurrenceCatchUpResultDto> {
    const until = rollingHorizon(ROLLING_HORIZON_MONTHS);
    const today = new Date(new Date().toISOString().slice(0, 10));

    const rules = await this.prisma.recurrenceRule.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: until },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
    });

    let created = 0;
    const failed: RecurrenceCatchUpFailureDto[] = [];

    for (const rule of rules) {
      try {
        const result = await this.generator.generate(userId, rule, until);
        created += result.created;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error({ msg: 'Recurrence catch-up failed for rule', userId, ruleId: rule.id, err: message });
        failed.push({ ruleId: rule.id, message });
      }
    }

    const result: RecurrenceCatchUpResultDto = { rulesProcessed: rules.length, created, failed, skippedLocked: false };

    this.logger.log({ msg: 'Recurrence catch-up run complete', userId, ...result });

    return result;
  }

  private async tryLock(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ locked: boolean }[]>(Prisma.sql`SELECT pg_try_advisory_lock(${LOCK_NAMESPACE}, hashtext(${userId})) AS locked`);

    return rows[0]?.locked ?? false;
  }

  private async unlock(userId: string): Promise<void> {
    await this.prisma.$queryRaw(Prisma.sql`SELECT pg_advisory_unlock(${LOCK_NAMESPACE}, hashtext(${userId}))`);
  }
}

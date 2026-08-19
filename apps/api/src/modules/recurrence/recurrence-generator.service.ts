import { Injectable } from '@nestjs/common';

import { badRequest } from '../../common/api-error';
import { type Prisma, type RecurrenceRule } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { computeOccurrences, referenceMonthFor } from './occurrences';

const SERIALIZABLE = { isolationLevel: 'Serializable' as const };

export interface GenerateResult {
  created: number;
  generatedUntil: Date | null;
}

/**
 * `RecurrenceRule` -> `Transaction` (M7-T02, ADR-0014). Two independent idempotency guards, both
 * inside the same `$transaction`, so a rerun (manual or a concurrent cron tick) is a no-op rather
 * than a duplicate or a crash: `generatedUntil` is only advanced once the rows exist, and the
 * unique index on `(recurrenceRuleId, referenceMonth)` backs `skipDuplicates` as the belt-and-braces
 * check when `generatedUntil` itself lags (e.g. after a restored backup).
 *
 * `installmentNumber`/`installmentTotal` are #198's concern (installment materialization); this
 * service only ever writes `null` for both.
 */
@Injectable()
export class RecurrenceGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, rule: RecurrenceRule, until: Date): Promise<GenerateResult> {
    if (rule.type !== 'INCOME' && rule.type !== 'EXPENSE') {
      throw badRequest('RECURRENCE_TYPE_NOT_ALLOWED', 'Recurrence rules only cover INCOME and EXPENSE transactions.');
    }

    if (!rule.isActive) {
      return { created: 0, generatedUntil: rule.generatedUntil };
    }

    return this.prisma.$transaction(async (tx) => {
      const alreadyGenerated = await tx.transaction.count({ where: { recurrenceRuleId: rule.id } });
      const occurrences = computeOccurrences(rule, until, alreadyGenerated);

      if (occurrences.length === 0) {
        return { created: 0, generatedUntil: rule.generatedUntil };
      }

      const data = occurrences.map((occurrenceDate) => this.toTransactionData(userId, rule, occurrenceDate));

      const result = await tx.transaction.createMany({ data, skipDuplicates: true });

      const lastOccurrenceDate = occurrences.at(-1)!;
      await tx.recurrenceRule.update({ where: { id: rule.id }, data: { generatedUntil: lastOccurrenceDate } });

      return { created: result.count, generatedUntil: lastOccurrenceDate };
    }, SERIALIZABLE);
  }

  /**
   * Copies fields off the rule rather than binding to it (ADR-0014): a later edit to `rule.amount`
   * must never reach through to a transaction already generated.
   */
  private toTransactionData(userId: string, rule: RecurrenceRule, occurrenceDate: Date): Prisma.TransactionCreateManyInput {
    return {
      userId,
      type: rule.type,
      amount: rule.amount,
      description: rule.description,
      notes: rule.notes,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      date: occurrenceDate,
      referenceMonth: referenceMonthFor(occurrenceDate),
      status: rule.autoConfirm ? 'CONFIRMED' : 'DRAFT',
      source: 'RECURRING',
      recurrenceRuleId: rule.id,
      installmentNumber: null,
      installmentTotal: null,
    };
  }
}

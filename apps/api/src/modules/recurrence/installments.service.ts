import { Injectable } from '@nestjs/common';

import { badRequest } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Prisma, type RecurrenceRule, type Transaction } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfMonthUtc } from '../transactions/reference-month';
import { type TransactionRefInput, TransactionValidator } from '../transactions/validators/transaction-validator';

import { CancelInstallmentPlanResultDto } from './dto/cancel-installment-plan-result.dto';
import { CreateInstallmentPlanDto } from './dto/create-installment-plan.dto';
import { InstallmentPlanDto } from './dto/installment-plan.dto';
import { InstallmentTransactionDto } from './dto/installment-transaction.dto';
import { RecurrenceRuleDto } from './dto/recurrence-rule.dto';
import { splitInstallments } from './installment-split';
import { computeOccurrences } from './occurrences';

const SERIALIZABLE = { isolationLevel: 'Serializable' as const };

/**
 * Installment plans (M7-T04, ADR-0014): a `RecurrenceRule` with `totalOccurrences = N`, materialized
 * in full at creation instead of on `RecurrenceGeneratorService`'s rolling horizon — a second entry
 * point into the same `RecurrenceRule`/`Transaction` family, not a fork of it. Reuses
 * `computeOccurrences` (M7-T02) for the monthly occurrence dates, so the 31st-of-the-month clamping
 * behaves identically to open-ended rules, and `TransactionValidator` (M4-T02) for cross-field
 * reference validation, so a plan and a plain transaction can never enforce different rules for the
 * same fields.
 */
@Injectable()
export class InstallmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TransactionValidator,
  ) {}

  async createPlan(userId: string, dto: CreateInstallmentPlanDto): Promise<InstallmentPlanDto> {
    const type = dto.type ?? 'EXPENSE';

    await this.validator.validate(userId, this.toRefInput(type, dto), { requireActive: true });

    const split = splitInstallments(dto.totalAmount, dto.installments);
    const occurrences = this.occurrenceDates(dto.firstPaymentDate, dto.installments);
    const lastOccurrence = occurrences.at(-1)!;
    const purchasedOn = dto.purchaseDate.toISOString().slice(0, 10);
    const status = dto.autoConfirm === false ? 'DRAFT' : 'CONFIRMED';
    const isCreditCard = dto.isCreditCard ?? false;

    const [rule, installments] = await this.prisma.$transaction(async (tx) => {
      const createdRule = await tx.recurrenceRule.create({
        data: {
          userId,
          type,
          amount: split[0]!,
          description: dto.description,
          notes: null,
          accountId: dto.accountId ?? null,
          categoryId: dto.categoryId ?? null,
          subcategoryId: dto.subcategoryId ?? null,
          frequency: 'MONTHLY',
          interval: 1,
          dayOfMonth: dto.firstPaymentDate.getUTCDate(),
          startDate: dto.firstPaymentDate,
          endDate: lastOccurrence,
          totalOccurrences: dto.installments,
          totalAmount: dto.totalAmount,
          autoConfirm: dto.autoConfirm ?? true,
          generatedUntil: lastOccurrence,
        },
      });

      const data: Prisma.TransactionCreateManyInput[] = occurrences.map((date, index) => ({
        userId,
        type,
        amount: split[index]!,
        description: dto.description,
        notes: `Purchased on ${purchasedOn}`,
        date,
        referenceMonth: startOfMonthUtc(date),
        isCreditCard,
        accountId: dto.accountId ?? null,
        categoryId: dto.categoryId ?? null,
        subcategoryId: dto.subcategoryId ?? null,
        status,
        source: 'RECURRING',
        recurrenceRuleId: createdRule.id,
        installmentNumber: index + 1,
        installmentTotal: dto.installments,
      }));

      await tx.transaction.createMany({ data });

      const createdInstallments = await tx.transaction.findMany({
        where: { recurrenceRuleId: createdRule.id },
        orderBy: { installmentNumber: 'asc' },
      });

      return [createdRule, createdInstallments] as const;
    }, SERIALIZABLE);

    return { rule: toRuleDto(rule), installments: installments.map(toInstallmentDto) };
  }

  /**
   * Deletes future, non-`CONFIRMED` installments and deactivates the rule. Confirmed installments and
   * past months are history — never touched (ADR-0015's deactivate-don't-delete applies to the rule
   * itself, not the transactions it already produced).
   */
  async cancelPlan(userId: string, ruleId: string): Promise<CancelInstallmentPlanResultDto> {
    const rule = assertOwnership(await this.prisma.recurrenceRule.findUnique({ where: { id: ruleId } }), userId);

    if (rule.totalOccurrences === null) {
      throw badRequest('RECURRENCE_NOT_INSTALLMENT_PLAN', 'This rule is open-ended; deactivate it through DELETE /recurrence-rules/:id instead.');
    }

    const currentMonth = startOfMonthUtc(new Date());

    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.transaction.deleteMany({
        where: { recurrenceRuleId: ruleId, status: { not: 'CONFIRMED' }, referenceMonth: { gte: currentMonth } },
      });

      await tx.recurrenceRule.update({ where: { id: ruleId }, data: { isActive: false } });

      return result.count;
    }, SERIALIZABLE);

    return { deleted };
  }

  private toRefInput(type: 'INCOME' | 'EXPENSE', dto: CreateInstallmentPlanDto): TransactionRefInput {
    return { type, accountId: dto.accountId, categoryId: dto.categoryId, subcategoryId: dto.subcategoryId };
  }

  /**
   * `N` consecutive monthly occurrences starting at `firstPaymentDate`, through `computeOccurrences`
   * so a plan starting on the 31st clamps to the 28th/29th in February exactly like an open-ended
   * rule. `until` is set comfortably past the last possible occurrence — `computeOccurrences` itself
   * stops at `totalOccurrences`.
   */
  private occurrenceDates(firstPaymentDate: Date, installments: number): Date[] {
    const until = new Date(Date.UTC(firstPaymentDate.getUTCFullYear(), firstPaymentDate.getUTCMonth() + installments + 1, 0));

    return computeOccurrences(
      {
        frequency: 'MONTHLY',
        interval: 1,
        dayOfMonth: firstPaymentDate.getUTCDate(),
        startDate: firstPaymentDate,
        endDate: null,
        totalOccurrences: installments,
        generatedUntil: null,
        isActive: true,
      },
      until,
      0,
    );
  }
}

/** Prisma row → response body. Mirrors `RecurrenceRulesService`'s `toDto` (M7-T03). */
function toRuleDto(rule: RecurrenceRule): RecurrenceRuleDto {
  return {
    id: rule.id,
    type: rule.type as 'INCOME' | 'EXPENSE',
    amount: rule.amount,
    description: rule.description,
    notes: rule.notes,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    subcategoryId: rule.subcategoryId,
    frequency: rule.frequency,
    interval: rule.interval,
    dayOfMonth: rule.dayOfMonth,
    startDate: rule.startDate.toISOString().slice(0, 10),
    endDate: rule.endDate?.toISOString().slice(0, 10) ?? null,
    totalOccurrences: rule.totalOccurrences,
    totalAmount: rule.totalAmount,
    autoConfirm: rule.autoConfirm,
    isActive: rule.isActive,
    generatedUntil: rule.generatedUntil?.toISOString().slice(0, 10) ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

/** Prisma row → response body, including the three installment-only fields `TransactionDto` omits. */
function toInstallmentDto(transaction: Transaction): InstallmentTransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    source: transaction.source,
    amount: transaction.amount,
    date: transaction.date.toISOString().slice(0, 10),
    referenceMonth: transaction.referenceMonth.toISOString().slice(0, 10),
    description: transaction.description,
    notes: transaction.notes,
    isCreditCard: transaction.isCreditCard,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    cashboxId: transaction.cashboxId,
    destinationCashboxId: transaction.destinationCashboxId,
    cashboxLabel: transaction.cashboxLabel,
    destinationCashboxLabel: transaction.destinationCashboxLabel,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    recurrenceRuleId: transaction.recurrenceRuleId!,
    installmentNumber: transaction.installmentNumber!,
    installmentTotal: transaction.installmentTotal!,
  };
}

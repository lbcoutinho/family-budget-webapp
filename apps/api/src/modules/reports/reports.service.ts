import { Injectable } from '@nestjs/common';

import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { MonthlyReportDto } from './dto/monthly-report.dto';
import { distributePercentages, rollingAverage } from './report-math';

type IncomeOrExpense = 'INCOME' | 'EXPENSE';
type CategoryLookup = Map<string, { name: string; color: string | null }>;
type CashboxLookup = Map<string, { name: string }>;

/** Grouped row shapes, named so the fold-in helpers below don't repeat Prisma's inferred types. */
interface WindowRow {
  referenceMonth: Date;
  categoryId: string | null;
  type: IncomeOrExpense;
  _sum: { amount: number | null };
}
interface SubcategoryRow {
  categoryId: string | null;
  subcategoryId: string | null;
  type: IncomeOrExpense;
  _sum: { amount: number | null };
}
interface CashboxSourceRow {
  cashboxId: string | null;
  cashboxLabel: string | null;
  type: 'CASHBOX_IN' | 'CASHBOX_OUT' | 'CASHBOX_TRANSFER';
  _sum: { amount: number | null };
}
interface CashboxDestinationRow {
  destinationCashboxId: string | null;
  destinationCashboxLabel: string | null;
  _sum: { amount: number | null };
}

/**
 * Builds the monthly-by-category report (M6-T01, #181). Like `BalancesService`, all aggregation is
 * pushed into Prisma `groupBy` — this class only reshapes grouped rows into the response tree
 * (`report-math.ts` carries the two bits of actual arithmetic: percentage distribution and rolling
 * average). Four `groupBy` calls share one `$transaction` snapshot: one twelve-month window (reused
 * for both the requested month's category totals and every category's rolling average, so the data
 * isn't fetched twice), one subcategory breakdown and two cashbox sides, both requested-month only.
 * Name/color lookups run after, outside the transaction — they don't need snapshot isolation with
 * the aggregation, only with each other, and `Promise.all` covers that.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthly(userId: string, year: number, month: number): Promise<MonthlyReportDto> {
    const end = new Date(Date.UTC(year, month - 1, 1));
    const start = new Date(Date.UTC(year, month - 1 - 11, 1));
    const where: Prisma.TransactionWhereInput = { userId, status: 'CONFIRMED' };

    const [windowRows, subcategoryRows, cashboxSourceRows, cashboxDestinationRows] = (await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({
          by: ['referenceMonth', 'categoryId', 'type'] as const,
          where: { ...where, type: { in: ['INCOME', 'EXPENSE'] }, referenceMonth: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        tx.transaction.groupBy({
          by: ['categoryId', 'subcategoryId', 'type'] as const,
          where: { ...where, type: { in: ['INCOME', 'EXPENSE'] }, referenceMonth: end },
          _sum: { amount: true },
        }),
        tx.transaction.groupBy({
          by: ['cashboxId', 'cashboxLabel', 'type'] as const,
          where: { ...where, type: { in: ['CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'] }, referenceMonth: end },
          _sum: { amount: true },
        }),
        tx.transaction.groupBy({
          by: ['destinationCashboxId', 'destinationCashboxLabel'] as const,
          where: { ...where, type: 'CASHBOX_TRANSFER', referenceMonth: end },
          _sum: { amount: true },
        }),
      ]),
    )) as [WindowRow[], SubcategoryRow[], CashboxSourceRow[], CashboxDestinationRow[]];

    const categoryIds = new Set<string>();
    for (const row of windowRows) if (row.categoryId) categoryIds.add(row.categoryId);
    for (const row of subcategoryRows) {
      if (row.categoryId) categoryIds.add(row.categoryId);
      if (row.subcategoryId) categoryIds.add(row.subcategoryId);
    }
    const cashboxIds = new Set<string>();
    for (const row of cashboxSourceRows) if (row.cashboxId) cashboxIds.add(row.cashboxId);
    for (const row of cashboxDestinationRows) if (row.destinationCashboxId) cashboxIds.add(row.destinationCashboxId);

    const [categoryRows, cashboxRows] = await Promise.all([
      categoryIds.size ? this.prisma.category.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true, color: true } }) : [],
      cashboxIds.size ? this.prisma.cashbox.findMany({ where: { id: { in: [...cashboxIds] } }, select: { id: true, name: true } }) : [],
    ]);
    const categoryLookup: CategoryLookup = new Map(categoryRows.map((c) => [c.id, { name: c.name, color: c.color }]));
    const cashboxLookup: CashboxLookup = new Map(cashboxRows.map((c) => [c.id, { name: c.name }]));

    const monthRows = windowRows.filter((row) => row.referenceMonth.getTime() === end.getTime());
    const incomeTotal = sumWhere(monthRows, (row) => row.type === 'INCOME');
    const expenseTotal = sumWhere(monthRows, (row) => row.type === 'EXPENSE');

    return {
      year,
      month,
      incomeTotal,
      expenseTotal,
      balance: incomeTotal - expenseTotal,
      categories: this.buildCategories(monthRows, windowRows, subcategoryRows, categoryLookup, incomeTotal, expenseTotal, year, month),
      cashboxes: this.buildCashboxes(cashboxSourceRows, cashboxDestinationRows, cashboxLookup),
    };
  }

  /** One row per (categoryId, kind) with activity this month, percentages independent per kind, subcategories and rolling average nested in. */
  private buildCategories(
    monthRows: WindowRow[],
    windowRows: WindowRow[],
    subcategoryRows: SubcategoryRow[],
    categoryLookup: CategoryLookup,
    incomeTotal: number,
    expenseTotal: number,
    year: number,
    month: number,
  ): MonthlyReportDto['categories'] {
    // Fold key is categoryId + kind, never categoryId alone: a category could in principle carry
    // both income and expense rows, and each side's percentage/total must stay on its own side.
    const buckets = new Map<string, { categoryId: string | null; kind: IncomeOrExpense; amount: number }>();
    for (const row of monthRows) {
      const key = `${row.categoryId ?? ''}|${row.type}`;
      const amount = row._sum.amount ?? 0;
      const existing = buckets.get(key);
      if (existing) existing.amount += amount;
      else buckets.set(key, { categoryId: row.categoryId, kind: row.type, amount });
    }

    const rows = [...buckets.values()];
    const incomeRows = rows.filter((row) => row.kind === 'INCOME');
    const expenseRows = rows.filter((row) => row.kind === 'EXPENSE');
    const incomePercentages = distributePercentages(
      incomeRows.map((r) => r.amount),
      incomeTotal,
    );
    const expensePercentages = distributePercentages(
      expenseRows.map((r) => r.amount),
      expenseTotal,
    );
    const percentageByKey = new Map<string, number>();
    incomeRows.forEach((row, index) => percentageByKey.set(`${row.categoryId ?? ''}|${row.kind}`, incomePercentages[index] ?? 0));
    expenseRows.forEach((row, index) => percentageByKey.set(`${row.categoryId ?? ''}|${row.kind}`, expensePercentages[index] ?? 0));

    const monthStarts = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(year, month - 1 - (11 - i), 1)));

    return rows
      .map((bucket) => {
        const key = `${bucket.categoryId ?? ''}|${bucket.kind}`;
        const category = bucket.categoryId ? categoryLookup.get(bucket.categoryId) : undefined;

        const rollingAmounts = windowRows.filter((row) => row.categoryId === bucket.categoryId && row.type === bucket.kind);
        const byMonth = new Map(rollingAmounts.map((row) => [row.referenceMonth.getTime(), row._sum.amount ?? 0]));
        const rollingSeries = monthStarts.map((monthStart) => byMonth.get(monthStart.getTime()) ?? 0);

        return {
          categoryId: bucket.categoryId,
          name: category?.name ?? null,
          color: category?.color ?? null,
          kind: bucket.kind,
          amount: bucket.amount,
          percentage: percentageByKey.get(key) ?? 0,
          rollingAverage: rollingAverage(rollingSeries),
          subcategories: this.buildSubcategories(bucket.categoryId, bucket.kind, bucket.amount, subcategoryRows, categoryLookup),
        };
      })
      .sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind.localeCompare(b.kind)));
  }

  /** Subcategory buckets (including the "no subcategory chosen" null bucket) under one category+kind, percentages against that category's own amount. */
  private buildSubcategories(
    categoryId: string | null,
    kind: IncomeOrExpense,
    categoryAmount: number,
    subcategoryRows: SubcategoryRow[],
    categoryLookup: CategoryLookup,
  ): MonthlyReportDto['categories'][number]['subcategories'] {
    const matching = subcategoryRows.filter((row) => row.categoryId === categoryId && row.type === kind);
    if (matching.length === 0) return [];

    const buckets = new Map<string | null, number>();
    for (const row of matching) {
      buckets.set(row.subcategoryId, (buckets.get(row.subcategoryId) ?? 0) + (row._sum.amount ?? 0));
    }

    const entries = [...buckets.entries()];
    const percentages = distributePercentages(
      entries.map(([, amount]) => amount),
      categoryAmount,
    );

    return entries
      .map(([subcategoryId, amount], index) => ({
        subcategoryId,
        name: subcategoryId ? (categoryLookup.get(subcategoryId)?.name ?? null) : null,
        amount,
        percentage: percentages[index] ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  /** Merges the source side (CASHBOX_IN/OUT/TRANSFER) and destination side (CASHBOX_TRANSFER receipt) into one bucket per cashbox. */
  private buildCashboxes(
    sourceRows: CashboxSourceRow[],
    destinationRows: CashboxDestinationRow[],
    cashboxLookup: CashboxLookup,
  ): MonthlyReportDto['cashboxes'] {
    const buckets = new Map<string, { cashboxId: string | null; label: string; deposits: number; withdrawals: number }>();

    const bucketFor = (id: string | null, label: string | null): { cashboxId: string | null; label: string; deposits: number; withdrawals: number } => {
      const key = id ?? label ?? '';
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { cashboxId: id, label: label ?? '', deposits: 0, withdrawals: 0 };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    for (const row of sourceRows) {
      const bucket = bucketFor(row.cashboxId, row.cashboxLabel);
      const amount = row._sum.amount ?? 0;
      if (row.type === 'CASHBOX_IN') bucket.deposits += amount;
      else bucket.withdrawals += amount;
    }
    for (const row of destinationRows) {
      const bucket = bucketFor(row.destinationCashboxId, row.destinationCashboxLabel);
      bucket.deposits += row._sum.amount ?? 0;
    }

    const items = [...buckets.values()]
      .map((bucket) => ({
        cashboxId: bucket.cashboxId,
        name: bucket.cashboxId ? (cashboxLookup.get(bucket.cashboxId)?.name ?? bucket.label) : bucket.label,
        deposits: bucket.deposits,
        withdrawals: bucket.withdrawals,
        balance: bucket.deposits - bucket.withdrawals,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      items,
      depositsTotal: items.reduce((sum, item) => sum + item.deposits, 0),
      withdrawalsTotal: items.reduce((sum, item) => sum + item.withdrawals, 0),
      balance: items.reduce((sum, item) => sum + item.balance, 0),
    };
  }
}

function sumWhere(rows: WindowRow[], predicate: (row: WindowRow) => boolean): number {
  return rows.filter(predicate).reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
}

import { Injectable } from '@nestjs/common';

import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfMonthUtc } from '../transactions/reference-month';

import { MonthlyReportDto } from './dto/monthly-report.dto';
import { YearlyReportDto } from './dto/yearly-report.dto';
import { averageWindow, distributePercentages, monthsEndingAt, rollingAverage } from './report-math';

type IncomeOrExpense = 'INCOME' | 'EXPENSE';
type CategoryLookup = Map<string, { name: string; color: string | null }>;
type CashboxLookup = Map<string, { name: string }>;

/** Grouped row shapes, named so the fold-in helpers below don't repeat Prisma's inferred types. */
interface WindowRow {
  referenceMonth: Date;
  categoryId: string | null;
  // Rides along so a category's rolling average can be split by subcategory too (mirrors
  // `buildSubcategories`'s own amount split, which uses `SubcategoryRow` for the requested month).
  subcategoryId: string | null;
  type: IncomeOrExpense;
  _sum: { amount: number | null };
}
interface SubcategoryRow {
  categoryId: string | null;
  subcategoryId: string | null;
  type: IncomeOrExpense;
  _sum: { amount: number | null };
}
interface YearlyRow {
  referenceMonth: Date;
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
    const { from: start } = averageWindow(end);
    const where: Prisma.TransactionWhereInput = { userId, status: 'CONFIRMED' };

    const [windowRows, subcategoryRows, cashboxSourceRows, cashboxDestinationRows] = (await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({
          by: ['referenceMonth', 'categoryId', 'subcategoryId', 'type'] as const,
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
      categories: this.buildCategories(monthRows, windowRows, subcategoryRows, categoryLookup, incomeTotal, expenseTotal, end),
      cashboxes: this.buildCashboxes(cashboxSourceRows, cashboxDestinationRows, cashboxLookup),
    };
  }

  /**
   * Builds the yearly-by-category matrix (M6-T02, #182). One `groupBy` covers the requested year,
   * the average window (which reaches back before January for the current year) and, when
   * `compare` is set, the prior year — `now` defaults to the real clock and is only ever overridden
   * from a test, to make the past-year-vs-current-year window selection deterministic.
   */
  async getYearly(userId: string, year: number, compare: boolean, now: Date = new Date()): Promise<YearlyReportDto> {
    const janOfYear = new Date(Date.UTC(year, 0, 1));
    const decOfYear = new Date(Date.UTC(year, 11, 1));
    const currentMonthStart = startOfMonthUtc(now);
    // Complete past year -> window ends in December of that year, so the average reconciles with
    // the matrix's own twelve columns. Current year -> window ends at the current month, reaching
    // back into the prior year.
    const windowEnd = currentMonthStart.getTime() < decOfYear.getTime() ? currentMonthStart : decOfYear;
    const { from: windowStart } = averageWindow(windowEnd);

    const janOfPriorYear = new Date(Date.UTC(year - 1, 0, 1));
    const rangeStart = [janOfYear, windowStart, ...(compare ? [janOfPriorYear] : [])].reduce((min, date) => (date.getTime() < min.getTime() ? date : min));
    const rangeEnd = windowEnd.getTime() > decOfYear.getTime() ? windowEnd : decOfYear;

    // A single `groupBy` call (unlike `getMonthly`'s `$transaction`-wrapped tuple above) keeps
    // Prisma's precise literal return type, which doesn't structurally overlap `YearlyRow[]`
    // enough for a direct assertion — same shape, so the `unknown` hop is just to satisfy that.
    // `subcategoryId` rides along so a category's rows can be split into a subcategory breakdown
    // without a second query; the root matrix still rolls every subcategory back up into its
    // category, same as before.
    const rows = (await this.prisma.transaction.groupBy({
      by: ['categoryId', 'subcategoryId', 'referenceMonth', 'type'] as const,
      where: { userId, status: 'CONFIRMED', type: { in: ['INCOME', 'EXPENSE'] }, referenceMonth: { gte: rangeStart, lte: rangeEnd } },
      _sum: { amount: true },
    })) as unknown as YearlyRow[];

    const categoryIds = new Set<string>();
    for (const row of rows) if (row.categoryId) categoryIds.add(row.categoryId);

    const categoryRows = categoryIds.size
      ? await this.prisma.category.findMany({ where: { id: { in: [...categoryIds] } }, select: { id: true, name: true, color: true } })
      : [];
    const categoryLookup: CategoryLookup = new Map(categoryRows.map((c) => [c.id, { name: c.name, color: c.color }]));

    const primary = this.buildYearMatrix(year, rows, categoryLookup);
    const withAverage = this.withMonthlyAverage(primary.categories, rows, windowEnd);
    const categories = withAverage.map((category) => ({
      ...category,
      subcategories: this.buildYearSubcategories(category.categoryId, category.kind, year, rows, categoryLookup),
    }));
    const comparison = compare ? this.buildYearMatrix(year - 1, rows, categoryLookup) : undefined;

    return {
      year,
      averageWindow: { from: dateOnly(windowStart), to: dateOnly(windowEnd) },
      months: primary.months,
      categories,
      totals: primary.totals,
      ...(comparison ? { comparison: { year: year - 1, ...comparison } } : {}),
    };
  }

  /** Folds grouped rows for one calendar year into matrix cells (zero-filled) and column totals. Shared by the requested year and, when `compare` is set, the prior one. */
  private buildYearMatrix(
    targetYear: number,
    rows: YearlyRow[],
    categoryLookup: CategoryLookup,
  ): {
    months: YearlyReportDto['months'];
    categories: { categoryId: string | null; name: string | null; color: string | null; kind: IncomeOrExpense; monthly: number[]; total: number }[];
    totals: YearlyReportDto['totals'];
  } {
    const monthStarts = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(targetYear, i, 1)));
    const yearRows = rows.filter((row) => row.referenceMonth.getUTCFullYear() === targetYear);

    const buckets = new Map<string, { categoryId: string | null; kind: IncomeOrExpense; monthly: number[] }>();
    for (const row of yearRows) {
      const key = `${row.categoryId ?? ''}|${row.type}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { categoryId: row.categoryId, kind: row.type, monthly: new Array(12).fill(0) as number[] };
        buckets.set(key, bucket);
      }
      const index = row.referenceMonth.getUTCMonth();
      bucket.monthly[index] = (bucket.monthly[index] ?? 0) + (row._sum.amount ?? 0);
    }

    const categories = [...buckets.values()]
      .map((bucket) => {
        const category = bucket.categoryId ? categoryLookup.get(bucket.categoryId) : undefined;
        return {
          categoryId: bucket.categoryId,
          name: category?.name ?? null,
          color: category?.color ?? null,
          kind: bucket.kind,
          monthly: bucket.monthly,
          total: bucket.monthly.reduce((sum, amount) => sum + amount, 0),
        };
      })
      .sort((a, b) => (a.kind === b.kind ? b.total - a.total : a.kind.localeCompare(b.kind)));

    const months = monthStarts.map((monthStart, index) => {
      const income = sumWhere(yearRows, (row) => row.type === 'INCOME' && row.referenceMonth.getTime() === monthStart.getTime());
      const expense = sumWhere(yearRows, (row) => row.type === 'EXPENSE' && row.referenceMonth.getTime() === monthStart.getTime());
      return { month: index + 1, income, expense, balance: income - expense };
    });

    return {
      months,
      categories,
      totals: {
        income: months.reduce((sum, m) => sum + m.income, 0),
        expense: months.reduce((sum, m) => sum + m.expense, 0),
        balance: months.reduce((sum, m) => sum + m.balance, 0),
      },
    };
  }

  /** Attaches each category's rolling average, computed over `windowEnd`'s twelve-month window rather than the matrix year — the two can diverge for the current year. */
  private withMonthlyAverage(
    categories: ReturnType<ReportsService['buildYearMatrix']>['categories'],
    rows: YearlyRow[],
    windowEnd: Date,
  ): Omit<YearlyReportDto['categories'][number], 'subcategories'>[] {
    const averageMonths = monthsEndingAt(windowEnd);

    return categories.map((category) => {
      const byMonth = sumByMonth(rows, (row) => row.categoryId === category.categoryId && row.type === category.kind);
      const series = averageMonths.map((month) => byMonth.get(month.getTime()) ?? 0);
      return { ...category, monthlyAverage: rollingAverage(series) };
    });
  }

  /** A category's own amounts split by subcategory for one calendar year, same zero-filled twelve-month shape as the root row. Mirrors `buildSubcategories` for the monthly report. */
  private buildYearSubcategories(
    categoryId: string | null,
    kind: IncomeOrExpense,
    targetYear: number,
    rows: YearlyRow[],
    categoryLookup: CategoryLookup,
  ): YearlyReportDto['categories'][number]['subcategories'] {
    const matching = rows.filter((row) => row.categoryId === categoryId && row.type === kind && row.referenceMonth.getUTCFullYear() === targetYear);
    if (matching.length === 0) return [];

    const buckets = new Map<string | null, number[]>();
    for (const row of matching) {
      let monthly = buckets.get(row.subcategoryId);
      if (!monthly) {
        monthly = new Array(12).fill(0) as number[];
        buckets.set(row.subcategoryId, monthly);
      }
      monthly[row.referenceMonth.getUTCMonth()] = (monthly[row.referenceMonth.getUTCMonth()] ?? 0) + (row._sum.amount ?? 0);
    }

    return [...buckets.entries()]
      .map(([subcategoryId, monthly]) => ({
        subcategoryId,
        name: subcategoryId ? (categoryLookup.get(subcategoryId)?.name ?? null) : null,
        monthly,
        total: monthly.reduce((sum, amount) => sum + amount, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }

  /** One row per (categoryId, kind) with activity this month, percentages independent per kind, subcategories and rolling average nested in. */
  private buildCategories(
    monthRows: WindowRow[],
    windowRows: WindowRow[],
    subcategoryRows: SubcategoryRow[],
    categoryLookup: CategoryLookup,
    incomeTotal: number,
    expenseTotal: number,
    end: Date,
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

    const monthStarts = monthsEndingAt(end);

    return rows
      .map((bucket) => {
        const key = `${bucket.categoryId ?? ''}|${bucket.kind}`;
        const category = bucket.categoryId ? categoryLookup.get(bucket.categoryId) : undefined;

        const byMonth = sumByMonth(windowRows, (row) => row.categoryId === bucket.categoryId && row.type === bucket.kind);
        const rollingSeries = monthStarts.map((monthStart) => byMonth.get(monthStart.getTime()) ?? 0);

        return {
          categoryId: bucket.categoryId,
          name: category?.name ?? null,
          color: category?.color ?? null,
          kind: bucket.kind,
          amount: bucket.amount,
          percentage: percentageByKey.get(key) ?? 0,
          rollingAverage: rollingAverage(rollingSeries),
          subcategories: this.buildSubcategories(bucket.categoryId, bucket.kind, bucket.amount, subcategoryRows, windowRows, categoryLookup, monthStarts),
        };
      })
      .sort((a, b) => (a.kind === b.kind ? b.amount - a.amount : a.kind.localeCompare(b.kind)));
  }

  /** Subcategory buckets (including the "no subcategory chosen" null bucket) under one category+kind, percentages against that category's own amount, each with its own rolling average over the same window as the parent. */
  private buildSubcategories(
    categoryId: string | null,
    kind: IncomeOrExpense,
    categoryAmount: number,
    subcategoryRows: SubcategoryRow[],
    windowRows: WindowRow[],
    categoryLookup: CategoryLookup,
    monthStarts: Date[],
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
      .map(([subcategoryId, amount], index) => {
        const byMonth = sumByMonth(windowRows, (row) => row.categoryId === categoryId && row.subcategoryId === subcategoryId && row.type === kind);
        const rollingSeries = monthStarts.map((monthStart) => byMonth.get(monthStart.getTime()) ?? 0);

        return {
          subcategoryId,
          name: subcategoryId ? (categoryLookup.get(subcategoryId)?.name ?? null) : null,
          amount,
          percentage: percentages[index] ?? 0,
          rollingAverage: rollingAverage(rollingSeries),
        };
      })
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

/** Sums `_sum.amount` per `referenceMonth`, for rows matching `predicate`. More than one grouped row
 * can share a month once `subcategoryId` splits the group (one row per subcategory in use that
 * month) — summing here, rather than building a `Map` straight from `[time, amount]` entries, is
 * what keeps every subcategory's amount instead of only the last one written to a given key. */
function sumByMonth<T extends { referenceMonth: Date; _sum: { amount: number | null } }>(rows: T[], predicate: (row: T) => boolean): Map<number, number> {
  const byMonth = new Map<number, number>();
  for (const row of rows) {
    if (!predicate(row)) continue;
    const time = row.referenceMonth.getTime();
    byMonth.set(time, (byMonth.get(time) ?? 0) + (row._sum.amount ?? 0));
  }
  return byMonth;
}

/** `@db.Date` columns render as plain `YYYY-MM-DD` in responses — same convention as `TransactionsService`. */
function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

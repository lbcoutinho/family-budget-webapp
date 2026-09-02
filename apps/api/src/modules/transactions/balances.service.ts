import { Injectable } from '@nestjs/common';

import { type Prisma, type TransactionType } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Sign each `TransactionType` contributes on the *source* side of an account balance
 * (`plans/0001-overview.md` §5.4). `TRANSFER`'s destination side is `+1` and is added separately in
 * `sumByAccount`, since it lands on a different row's `destinationAccountId`, not `accountId`. A
 * `Record` over every `TransactionType` so a new type fails this file's compile instead of silently
 * contributing zero.
 */
export const ACCOUNT_SIGN: Record<TransactionType, -1 | 0 | 1> = {
  INCOME: 1,
  EXPENSE: -1,
  TRANSFER: -1,
  CASHBOX_IN: -1,
  CASHBOX_OUT: 1,
  CASHBOX_TRANSFER: 0,
};

/**
 * Same idea as `ACCOUNT_SIGN`, for cashbox balances. `CASHBOX_TRANSFER`'s destination `+1` is added
 * separately in `sumByCashbox` and `monthlyByCashbox`. Exported so `ReportsService` (M6-T05, #185)
 * can fold `monthlyByCashbox`'s raw rows into a running balance without duplicating the sign table.
 */
export const CASHBOX_SIGN: Record<TransactionType, -1 | 0 | 1> = {
  INCOME: 0,
  EXPENSE: 0,
  TRANSFER: 0,
  CASHBOX_IN: 1,
  CASHBOX_OUT: -1,
  CASHBOX_TRANSFER: -1,
};

/** One `groupBy` bucket from `monthlyByCashbox`'s source side — a cashbox's own `CASHBOX_IN`/`CASHBOX_OUT`/`CASHBOX_TRANSFER` rows for one month. */
export interface CashboxMonthlySourceRow {
  cashboxId: string | null;
  cashboxLabel: string | null;
  type: 'CASHBOX_IN' | 'CASHBOX_OUT' | 'CASHBOX_TRANSFER';
  referenceMonth: Date;
  _sum: { amount: number | null };
}

/** One `groupBy` bucket from `monthlyByCashbox`'s destination side — the receiving half of a `CASHBOX_TRANSFER`, for one month. */
export interface CashboxMonthlyDestinationRow {
  destinationCashboxId: string | null;
  destinationCashboxLabel: string | null;
  referenceMonth: Date;
  _sum: { amount: number | null };
}

/**
 * The single place `status = CONFIRMED` lives for balance queries (M4-T07, #104). Every account and
 * cashbox balance in the app — including the guard reads inside `TransactionsService` — is meant to
 * route through here rather than reaching for `prisma.transaction` directly, so that filter cannot
 * be forgotten by a future query.
 *
 * Aggregation is `groupBy`, never folded from raw rows in Node: a handful of grouped sums per
 * entity, not one pass per transaction. The two `groupBy` calls per method run inside one
 * `$transaction` so both sides of a transfer are read from the same snapshot.
 */
@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async sumByAccount(userId: string, asOf?: Date): Promise<Map<string, number>> {
    return this.sumByAccountWhere(this.where(userId, asOf));
  }

  async sumByCashbox(userId: string, asOf?: Date): Promise<Map<string, number>> {
    return this.sumByCashboxWhere(this.where(userId, asOf));
  }

  /** Confirmed balance movements through an accounting month's close, never transaction date. */
  async sumByAccountReferenceMonth(userId: string, referenceMonth: Date): Promise<Map<string, number>> {
    return this.sumByAccountWhere({ userId, status: 'CONFIRMED', referenceMonth: { lte: referenceMonth } });
  }

  /** Confirmed cashbox movements through an accounting month's close, never transaction date. */
  async sumByCashboxReferenceMonth(userId: string, referenceMonth: Date): Promise<Map<string, number>> {
    return this.sumByCashboxWhere({ userId, status: 'CONFIRMED', referenceMonth: { lte: referenceMonth } });
  }

  /** Confirmed account movements by accounting month through December of `year`. */
  async accountMovementsByReferenceMonth(userId: string, year: number): Promise<Map<number, Map<string, number>>> {
    const where: Prisma.TransactionWhereInput = { userId, status: 'CONFIRMED', referenceMonth: { lte: new Date(Date.UTC(year, 11, 1)) } };
    const [source, destination] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({
          by: ['accountId', 'type', 'referenceMonth'],
          _sum: { amount: true },
          where: { ...where, accountId: { not: null } },
        }),
        tx.transaction.groupBy({
          by: ['destinationAccountId', 'referenceMonth'],
          _sum: { amount: true },
          where: { ...where, type: 'TRANSFER' },
        }),
      ]),
    );

    return movementsByMonth(source, destination, 'accountId', 'destinationAccountId', ACCOUNT_SIGN);
  }

  /** Confirmed cashbox movements by accounting month through December of `year`. */
  async cashboxMovementsByReferenceMonth(userId: string, year: number): Promise<Map<number, Map<string, number>>> {
    const where: Prisma.TransactionWhereInput = { userId, status: 'CONFIRMED', referenceMonth: { lte: new Date(Date.UTC(year, 11, 1)) } };
    const [source, destination] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({
          by: ['cashboxId', 'type', 'referenceMonth'],
          _sum: { amount: true },
          where: { ...where, cashboxId: { not: null } },
        }),
        tx.transaction.groupBy({
          by: ['destinationCashboxId', 'referenceMonth'],
          _sum: { amount: true },
          where: { ...where, type: 'CASHBOX_TRANSFER' },
        }),
      ]),
    );

    return movementsByMonth(source, destination, 'cashboxId', 'destinationCashboxId', CASHBOX_SIGN);
  }

  /**
   * Monthly cashbox movement for `ReportsService.cashboxes` (M6-T05, #185), grouped by
   * `referenceMonth` rather than `date` — reports always group by reference month. No lower bound:
   * every row up to and including December of `year` comes back, so the caller folds everything
   * before January of `year` into an opening balance instead of running a second query. Raw grouped
   * rows only — shaping (per-cashbox, per-month totals, running balance) is `ReportsService`'s job.
   */
  async monthlyByCashbox(userId: string, year: number): Promise<{ source: CashboxMonthlySourceRow[]; destination: CashboxMonthlyDestinationRow[] }> {
    const upperBound = new Date(Date.UTC(year, 11, 1));
    const where: Prisma.TransactionWhereInput = { userId, status: 'CONFIRMED', referenceMonth: { lte: upperBound } };

    const [source, destination] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({
          by: ['cashboxId', 'cashboxLabel', 'type', 'referenceMonth'],
          _sum: { amount: true },
          where: { ...where, type: { in: ['CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'] } },
        }),
        tx.transaction.groupBy({
          by: ['destinationCashboxId', 'destinationCashboxLabel', 'referenceMonth'],
          _sum: { amount: true },
          where: { ...where, type: 'CASHBOX_TRANSFER' },
        }),
      ]),
    );

    return { source: source as CashboxMonthlySourceRow[], destination };
  }

  /** The only shape a balance query may take. `status = CONFIRMED` is not optional here. */
  private where(userId: string, asOf?: Date): Prisma.TransactionWhereInput {
    return { userId, status: 'CONFIRMED', settlementDate: { lte: asOf ?? new Date() } };
  }

  private async sumByAccountWhere(where: Prisma.TransactionWhereInput): Promise<Map<string, number>> {
    const [bySource, byDestination] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({ by: ['accountId', 'type'], _sum: { amount: true }, where: { ...where, accountId: { not: null } } }),
        tx.transaction.groupBy({ by: ['destinationAccountId'], _sum: { amount: true }, where: { ...where, type: 'TRANSFER' } }),
      ]),
    );

    return accountBalances(bySource, byDestination);
  }

  private async sumByCashboxWhere(where: Prisma.TransactionWhereInput): Promise<Map<string, number>> {
    const [bySource, byDestination] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.transaction.groupBy({ by: ['cashboxId', 'type'], _sum: { amount: true }, where: { ...where, cashboxId: { not: null } } }),
        tx.transaction.groupBy({ by: ['destinationCashboxId'], _sum: { amount: true }, where: { ...where, type: 'CASHBOX_TRANSFER' } }),
      ]),
    );

    return cashboxBalances(bySource, byDestination);
  }
}

function accountBalances(
  bySource: { accountId: string | null; type: TransactionType; _sum: { amount: number | null } }[],
  byDestination: { destinationAccountId: string | null; _sum: { amount: number | null } }[],
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const row of bySource) if (row.accountId !== null) add(balances, row.accountId, (row._sum.amount ?? 0) * ACCOUNT_SIGN[row.type]);
  for (const row of byDestination) if (row.destinationAccountId !== null) add(balances, row.destinationAccountId, row._sum.amount ?? 0);
  return balances;
}

function cashboxBalances(
  bySource: { cashboxId: string | null; type: TransactionType; _sum: { amount: number | null } }[],
  byDestination: { destinationCashboxId: string | null; _sum: { amount: number | null } }[],
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const row of bySource) if (row.cashboxId !== null) add(balances, row.cashboxId, (row._sum.amount ?? 0) * CASHBOX_SIGN[row.type]);
  for (const row of byDestination) if (row.destinationCashboxId !== null) add(balances, row.destinationCashboxId, row._sum.amount ?? 0);
  return balances;
}

function add(balances: Map<string, number>, id: string, amount: number): void {
  balances.set(id, (balances.get(id) ?? 0) + amount);
}

function movementsByMonth(
  source: { type: TransactionType; referenceMonth: Date; _sum: { amount: number | null }; [id: string]: unknown }[],
  destination: { referenceMonth: Date; _sum: { amount: number | null }; [id: string]: unknown }[],
  sourceId: string,
  destinationId: string,
  signs: Record<TransactionType, -1 | 0 | 1>,
): Map<number, Map<string, number>> {
  const months = new Map<number, Map<string, number>>();
  const addToMonth = (month: Date, id: unknown, amount: number): void => {
    if (typeof id !== 'string') return;
    const balances = months.get(month.getTime()) ?? new Map<string, number>();
    add(balances, id, amount);
    months.set(month.getTime(), balances);
  };

  for (const row of source) addToMonth(row.referenceMonth, row[sourceId], (row._sum.amount ?? 0) * signs[row.type]);
  for (const row of destination) addToMonth(row.referenceMonth, row[destinationId], row._sum.amount ?? 0);
  return months;
}

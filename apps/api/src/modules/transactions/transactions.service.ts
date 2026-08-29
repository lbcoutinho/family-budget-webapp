import { Injectable } from '@nestjs/common';

import { badRequest, conflict } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Prisma, type Transaction } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cashboxBalances } from '../cashboxes/cashbox-balance';

import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto, TransactionSort } from './dto/list-transactions-query.dto';
import { TransactionListDto, type TransactionListItemDto } from './dto/transaction-list.dto';
import { TransactionDto } from './dto/transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { resolveReferenceMonthOnCreate, resolveReferenceMonthOnUpdate, resolveSettlementDate, startOfMonthUtc } from './reference-month';
import { type ResolvedTransactionRefs, type TransactionRefInput, TransactionValidator } from './validators/transaction-validator';

const LIST_INCLUDE = {
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, color: true } },
  subcategory: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TransactionInclude;

type ListedTransaction = Prisma.TransactionGetPayload<{ include: typeof LIST_INCLUDE }>;

/**
 * One `orderBy` per `TransactionSort` (M5-T07). Every entry ends in `{ id: 'desc' }`: cursor
 * pagination (`cursor: { id }` + `skip: 1`) needs a fully deterministic ordering, or a tie on the
 * leading column(s) could skip or repeat a row across pages.
 */
const SORT_ORDER_BY: Record<TransactionSort, Prisma.TransactionOrderByWithRelationInput[]> = {
  [TransactionSort.NEWEST]: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  [TransactionSort.OLDEST]: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'desc' }],
  [TransactionSort.AMOUNT_HIGHEST]: [{ amount: 'desc' }, { date: 'desc' }, { id: 'desc' }],
  [TransactionSort.AMOUNT_LOWEST]: [{ amount: 'asc' }, { date: 'desc' }, { id: 'desc' }],
  [TransactionSort.DESCRIPTION]: [{ description: 'asc' }, { date: 'desc' }, { id: 'desc' }],
};

/**
 * `INCOME`/`EXPENSE`/`TRANSFER`/`CASHBOX_IN`/`CASHBOX_OUT`/`CASHBOX_TRANSFER` CRUD (M4-T04, M4-T05,
 * M4-T06) plus the filtered, paginated list (M4-T08) — the first real consumer of
 * `TransactionValidator` (M4-T02), the `referenceMonth` rules (M4-T03) and `cashboxBalances`
 * (M4-T05). Follows the shape `CashboxesService` set: every query `userId`-scoped, `assertOwnership`
 * for 404-on-not-yours (ADR-0006), no HTTP decisions here.
 *
 * A write that can move money in or out of a cashbox runs inside `$transaction({ isolationLevel:
 * 'Serializable' })`: the balance guard reads and the row write must be atomic, or a concurrent
 * withdrawal could slip past it. Single-user app, so a serialization failure (P2034) is left
 * unhandled rather than retried — ponytail: add retry-on-P2034 if this ever becomes multi-user.
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TransactionValidator,
  ) {}

  /**
   * Two queries in one `prisma.$transaction([...])` so the page and its aggregates read the same
   * snapshot. `id desc` is appended to the ordering because cursor pagination needs a fully
   * deterministic sort — otherwise a `date`/`createdAt` tie could skip or repeat a row across pages.
   * `limit + 1` rows are fetched so `nextCursor` is known without a second round-trip: if the extra
   * row came back, it is dropped and its predecessor's id becomes `nextCursor`.
   */
  async findAll(userId: string, query: ListTransactionsQueryDto): Promise<TransactionListDto> {
    const where = this.buildWhere(userId, query);

    const [rows, totals] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: SORT_ORDER_BY[query.sort ?? TransactionSort.NEWEST],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: LIST_INCLUDE,
      }),
      this.prisma.transaction.groupBy({ by: ['type'], where, _sum: { amount: true }, _count: { _all: true } }),
    ]);

    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit).map(toListItemDto);

    return {
      items,
      total: totals.reduce((sum, t) => sum + t._count._all, 0),
      incomeTotal: totals.find((t) => t.type === 'INCOME')?._sum.amount ?? 0,
      expenseTotal: totals.find((t) => t.type === 'EXPENSE')?._sum.amount ?? 0,
      cashboxInTotal: totals.find((t) => t.type === 'CASHBOX_IN')?._sum.amount ?? 0,
      cashboxOutTotal: totals.find((t) => t.type === 'CASHBOX_OUT')?._sum.amount ?? 0,
      nextCursor: hasNextPage ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async findOne(userId: string, id: string): Promise<TransactionDto> {
    return toDto(await this.load(userId, id));
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    const refs = await this.validator.validate(userId, dto, { requireActive: true });

    const isCreditCard = dto.isCreditCard ?? false;
    const legacyReferenceMonth = resolveReferenceMonthOnCreate({ date: dto.date, referenceMonth: dto.referenceMonth });
    const settlementDate = resolveSettlementDate(dto.date, legacyReferenceMonth, isCreditCard, dto.settlementDate);
    assertSettlementIsNotBeforeDate(dto.date, settlementDate, isCreditCard);
    const referenceMonth = dto.settlementDate && isCreditCard ? startOfMonthUtc(settlementDate) : legacyReferenceMonth;
    const cashboxIds = collectCashboxIds(refs.cashbox?.id, refs.destinationCashbox?.id);

    const created = await this.prisma.$transaction(async (tx) => {
      const before = cashboxIds.length === 0 ? null : await cashboxBalances(tx, userId, cashboxIds);

      const row = await tx.transaction.create({
        data: {
          ...dto,
          userId,
          referenceMonth,
          settlementDate,
          cashboxLabel: refs.cashbox?.name ?? null,
          destinationCashboxLabel: refs.destinationCashbox?.name ?? null,
        },
      });

      if (before !== null) {
        await this.assertNonNegative(tx, userId, cashboxIds, before);
      }

      return row;
    }, SERIALIZABLE);

    return toDto(created);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    const current = await this.load(userId, id);

    if (dto.type !== undefined && dto.type !== current.type) {
      throw badRequest('TRANSACTION_TYPE_IMMUTABLE', 'type cannot be changed after creation.');
    }

    const resultingAmount = dto.amount !== undefined ? dto.amount : current.amount;
    const resultingStatus = dto.status ?? current.status;

    if (resultingAmount === null && resultingStatus === 'CONFIRMED') {
      throw badRequest('TRANSACTION_AMOUNT_REQUIRED_WHEN_CONFIRMED', 'amount is required to confirm a transaction.');
    }

    // The validator only runs when the patch actually touches a ref field — editing the
    // description of an old transaction must not fail because its category (or cashbox) was since
    // retired (ADR-0015).
    let refs: ResolvedTransactionRefs | undefined;

    if (
      dto.accountId !== undefined ||
      dto.destinationAccountId !== undefined ||
      dto.categoryId !== undefined ||
      dto.subcategoryId !== undefined ||
      dto.cashboxId !== undefined ||
      dto.destinationCashboxId !== undefined
    ) {
      const mergedRefs: TransactionRefInput = {
        type: current.type,
        accountId: dto.accountId ?? current.accountId ?? undefined,
        destinationAccountId: dto.destinationAccountId ?? current.destinationAccountId ?? undefined,
        categoryId: dto.categoryId ?? current.categoryId ?? undefined,
        subcategoryId: dto.subcategoryId ?? current.subcategoryId ?? undefined,
        cashboxId: dto.cashboxId ?? current.cashboxId ?? undefined,
        destinationCashboxId: dto.destinationCashboxId ?? current.destinationCashboxId ?? undefined,
      };

      refs = await this.validator.validate(userId, mergedRefs, { requireActive: true });
    }

    const legacyReferenceMonth = resolveReferenceMonthOnUpdate(
      { date: current.date, referenceMonth: current.referenceMonth, isCreditCard: current.isCreditCard },
      { date: dto.date, referenceMonth: dto.referenceMonth, isCreditCard: dto.isCreditCard },
    );
    const date = dto.date ?? current.date;
    const isCreditCard = dto.isCreditCard ?? current.isCreditCard;
    const settlementDate = isCreditCard ? (dto.settlementDate ?? current.settlementDate) : date;
    assertSettlementIsNotBeforeDate(date, settlementDate, isCreditCard);
    const referenceMonth = dto.settlementDate && isCreditCard ? startOfMonthUtc(settlementDate) : legacyReferenceMonth;

    // Re-snapshotting the label only when the id field itself was patched — not merely because the
    // validator ran for some other reason — is what ADR-0019 means by "kept in sync ... never
    // touched otherwise".
    const cashboxIds = collectCashboxIds(current.cashboxId, current.destinationCashboxId, dto.cashboxId, dto.destinationCashboxId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const before = cashboxIds.length === 0 ? null : await cashboxBalances(tx, userId, cashboxIds);

      const row = await tx.transaction.update({
        where: { id },
        data: {
          ...dto,
          referenceMonth,
          settlementDate,
          ...(dto.cashboxId !== undefined ? { cashboxLabel: refs?.cashbox?.name ?? null } : {}),
          ...(dto.destinationCashboxId !== undefined ? { destinationCashboxLabel: refs?.destinationCashbox?.name ?? null } : {}),
        },
      });

      if (before !== null) {
        await this.assertNonNegative(tx, userId, cashboxIds, before);
      }

      return row;
    }, SERIALIZABLE);

    return toDto(updated);
  }

  /** Permanent — a transaction has no history worth preserving. */
  async remove(userId: string, id: string): Promise<void> {
    const current = await this.load(userId, id);
    const cashboxIds = collectCashboxIds(current.cashboxId, current.destinationCashboxId);

    await this.prisma.$transaction(async (tx) => {
      const before = cashboxIds.length === 0 ? null : await cashboxBalances(tx, userId, cashboxIds);

      await tx.transaction.delete({ where: { id } });

      if (before !== null) {
        await this.assertNonNegative(tx, userId, cashboxIds, before);
      }
    }, SERIALIZABLE);
  }

  private async load(userId: string, id: string): Promise<Transaction> {
    return assertOwnership(await this.prisma.transaction.findUnique({ where: { id } }), userId);
  }

  /**
   * Recomputes every affected cashbox's balance after the write and rejects if any went negative —
   * one guard covering create, an amount raised on an existing withdrawal, a withdrawal moved to a
   * different cashbox, a transfer's destination changed, and a funding `CASHBOX_IN` deleted out from
   * under an already-spent balance. `before` only feeds the error message: the pass/fail check is
   * always against the post-write balance.
   */
  private async assertNonNegative(tx: Prisma.TransactionClient, userId: string, ids: string[], before: Map<string, number>): Promise<void> {
    const after = await cashboxBalances(tx, userId, ids);

    for (const id of ids) {
      if ((after.get(id) ?? 0) < 0) {
        throw conflict('CASHBOX_INSUFFICIENT_FUNDS', `This would leave a cashbox balance negative — available balance: ${before.get(id) ?? 0} cents.`);
      }
    }
  }

  private buildWhere(userId: string, query: ListTransactionsQueryDto): Prisma.TransactionWhereInput {
    return {
      userId,
      status: query.status ?? 'CONFIRMED',
      ...(query.referenceMonth ? { referenceMonth: startOfMonthUtc(query.referenceMonth) } : {}),
      ...(query.dateFrom !== undefined || query.dateTo !== undefined
        ? { date: { ...(query.dateFrom !== undefined ? { gte: query.dateFrom } : {}), ...(query.dateTo !== undefined ? { lte: query.dateTo } : {}) } }
        : {}),
      ...(query.type ? { type: { in: query.type } } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
      ...(query.cashboxId ? { cashboxId: query.cashboxId } : {}),
      ...(query.isCreditCard !== undefined ? { isCreditCard: query.isCreditCard } : {}),
      ...(query.search
        ? { OR: [{ description: { contains: query.search, mode: 'insensitive' } }, { notes: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };
  }
}

const SERIALIZABLE = { isolationLevel: 'Serializable' as const };

/** Every distinct, non-null cashbox id among the arguments — the set a balance guard must check. */
function collectCashboxIds(...ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => id !== null && id !== undefined))];
}

function assertSettlementIsNotBeforeDate(date: Date, settlementDate: Date, isCreditCard: boolean): void {
  if (isCreditCard && settlementDate < date) {
    throw badRequest('TRANSACTION_SETTLEMENT_BEFORE_DATE', 'Settlement date cannot be before transaction date.');
  }
}

/** Prisma row → response body. Date columns become plain `YYYY-MM-DD`, `userId` is dropped. */
function toDto(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    source: transaction.source,
    amount: transaction.amount,
    date: transaction.date.toISOString().slice(0, 10),
    referenceMonth: transaction.referenceMonth.toISOString().slice(0, 10),
    settlementDate: transaction.settlementDate.toISOString().slice(0, 10),
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
    recurrenceRuleId: transaction.recurrenceRuleId,
    installmentNumber: transaction.installmentNumber,
    installmentTotal: transaction.installmentTotal,
  };
}

/** `toDto` plus the three expanded relations a list row carries. */
function toListItemDto(transaction: ListedTransaction): TransactionListItemDto {
  return { ...toDto(transaction), account: transaction.account, category: transaction.category, subcategory: transaction.subcategory };
}

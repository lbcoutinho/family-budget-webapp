import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { TransactionStatus, TransactionSource, type Transaction } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { type ListTransactionsQueryDto, TransactionSort } from './dto/list-transactions-query.dto';
import { TransactionsService } from './transactions.service';
import { type ResolvedTransactionRefs, type TransactionValidator } from './validators/transaction-validator';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const transactionId = '33333333-3333-3333-3333-333333333333';
const accountId = '44444444-4444-4444-4444-444444444444';
const destinationAccountId = '99999999-9999-9999-9999-999999999999';
const categoryId = '55555555-5555-5555-5555-555555555555';
const subcategoryId = '66666666-6666-6666-6666-666666666666';
const cashboxId = '77777777-7777-7777-7777-777777777777';
const destinationCashboxId = '88888888-8888-8888-8888-888888888888';

const NO_REFS: ResolvedTransactionRefs = {
  account: null,
  destinationAccount: null,
  cashbox: null,
  destinationCashbox: null,
  category: null,
  subcategory: null,
};

const row = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: transactionId,
  userId,
  type: 'EXPENSE',
  status: TransactionStatus.CONFIRMED,
  source: TransactionSource.MANUAL,
  amount: 1_000,
  date: new Date('2026-03-15'),
  referenceMonth: new Date('2026-03-01'),
  settlementDate: new Date('2026-03-15'),
  description: 'Coffee',
  notes: null,
  isCreditCard: false,
  accountId,
  destinationAccountId: null,
  categoryId,
  subcategoryId,
  cashboxId: null,
  destinationCashboxId: null,
  cashboxLabel: null,
  destinationCashboxLabel: null,
  recurrenceRuleId: null,
  installmentNumber: null,
  installmentTotal: null,
  createdAt: new Date('2026-03-16T10:00:00.000Z'),
  updatedAt: new Date('2026-03-16T10:00:00.000Z'),
  ...overrides,
});

/**
 * `$transaction` runs the callback against the same `transaction` double, so a test can assert on
 * `create`/`update`/`delete`/`groupBy` calls without caring whether they happened inside or outside
 * the (mocked) interactive transaction.
 */
const doubles = (): {
  prisma: PrismaService;
  validator: TransactionValidator;
  transaction: Record<'findUnique' | 'findMany' | 'create' | 'update' | 'delete' | 'groupBy', jest.Mock>;
  validate: jest.Mock;
} => {
  const transaction = {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  };
  // `$transaction` doubles for both call shapes the service uses: a callback (create/update/remove)
  // and an array of already-issued promises (findAll's `[findMany, groupBy]`).
  const account = { findMany: jest.fn().mockResolvedValue([]) };
  const $transaction = jest.fn((arg: ((tx: { transaction: typeof transaction; account: typeof account }) => unknown) | unknown[]) =>
    Array.isArray(arg) ? Promise.all(arg) : arg({ transaction, account }),
  );
  const validate = jest.fn().mockResolvedValue(NO_REFS);

  return {
    prisma: { transaction, account, $transaction } as unknown as PrismaService,
    validator: { validate } as unknown as TransactionValidator,
    transaction,
    validate,
  };
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  let doubled: ReturnType<typeof doubles>;

  beforeEach(() => {
    doubled = doubles();
    service = new TransactionsService(doubled.prisma, doubled.validator);
  });

  describe('create', () => {
    it('validates with requireActive, resolves referenceMonth from date, and persists under the token userId', async () => {
      doubled.transaction.create.mockResolvedValue(row());

      const dto = { type: 'EXPENSE' as const, amount: 1_000, date: new Date('2026-03-15'), description: 'Coffee', accountId, categoryId, subcategoryId };

      await service.create(userId, dto);

      expect(doubled.validate).toHaveBeenCalledWith(userId, dto, { requireActive: true });
      expect(doubled.transaction.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          userId,
          referenceMonth: new Date('2026-03-01'),
          settlementDate: new Date('2026-03-15'),
          cashboxLabel: null,
          destinationCashboxLabel: null,
        },
      });
    });

    it('derives a card reference month from its explicit settlement date', async () => {
      doubled.transaction.create.mockResolvedValue(row({ isCreditCard: true }));
      const dto = {
        type: 'EXPENSE' as const,
        amount: 1_000,
        date: new Date('2026-03-15'),
        settlementDate: new Date('2026-04-20'),
        isCreditCard: true,
        description: 'Coffee',
      };

      await service.create(userId, dto);

      expect(doubled.transaction.create).toHaveBeenCalledWith({
        data: { ...dto, userId, referenceMonth: new Date('2026-04-01'), cashboxLabel: null, destinationCashboxLabel: null },
      });
    });

    it('skips the balance guard entirely for INCOME/EXPENSE — no groupBy query', async () => {
      doubled.transaction.create.mockResolvedValue(row());

      await service.create(userId, { type: 'EXPENSE' as const, amount: 1_000, date: new Date('2026-03-15'), description: 'Coffee' });

      expect(doubled.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('snapshots cashboxLabel/destinationCashboxLabel from the resolved refs on a CASHBOX_TRANSFER', async () => {
      doubled.validate.mockResolvedValue({
        ...NO_REFS,
        cashbox: { id: cashboxId, name: 'Carro' },
        destinationCashbox: { id: destinationCashboxId, name: 'Férias' },
      });
      doubled.transaction.create.mockResolvedValue(row());

      const dto = { type: 'CASHBOX_TRANSFER' as const, amount: 1_000, date: new Date('2026-03-15'), description: 'Move', cashboxId, destinationCashboxId };

      await service.create(userId, dto);

      expect(doubled.transaction.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          userId,
          referenceMonth: new Date('2026-03-01'),
          settlementDate: new Date('2026-03-15'),
          cashboxLabel: 'Carro',
          destinationCashboxLabel: 'Férias',
        },
      });
    });

    it('creates a TRANSFER with destinationAccountId and no cashbox — no groupBy query', async () => {
      doubled.transaction.create.mockResolvedValue(row({ type: 'TRANSFER', accountId, destinationAccountId, categoryId: null, subcategoryId: null }));

      const dto = { type: 'TRANSFER' as const, amount: 1_000, date: new Date('2026-03-15'), description: 'Move', accountId, destinationAccountId };

      await service.create(userId, dto);

      expect(doubled.transaction.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          userId,
          referenceMonth: new Date('2026-03-01'),
          settlementDate: new Date('2026-03-15'),
          cashboxLabel: null,
          destinationCashboxLabel: null,
        },
      });
      expect(doubled.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('raises 409 CASHBOX_INSUFFICIENT_FUNDS, naming the pre-write balance, when the write would go negative', async () => {
      doubled.validate.mockResolvedValue({ ...NO_REFS, cashbox: { id: cashboxId, name: 'Carro' } });
      doubled.transaction.groupBy.mockResolvedValue([{ type: 'CASHBOX_OUT', cashboxId, destinationCashboxId: null, _sum: { amount: 6_000 } }]);
      doubled.transaction.create.mockResolvedValue(row({ cashboxId }));

      const dto = { type: 'CASHBOX_OUT' as const, amount: 1_000, date: new Date('2026-03-15'), description: 'Withdraw', accountId, cashboxId };

      await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);

      // The pre-write balance (before this withdrawal is counted) is 0 — nothing funded the cashbox.
      await expect(service.create(userId, dto)).rejects.toMatchObject({
        response: { code: 'CASHBOX_INSUFFICIENT_FUNDS', message: expect.stringContaining('0 cents') as unknown },
      });
    });
  });

  describe('findAll', () => {
    const listQuery = (overrides: Partial<ListTransactionsQueryDto> = {}): ListTransactionsQueryDto => ({
      limit: 50,
      sort: TransactionSort.NEWEST,
      ...overrides,
    });

    it('defaults status to CONFIRMED when the query omits it, and passes the explicit value when it does not', async () => {
      await service.findAll(userId, listQuery());
      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'CONFIRMED' }) as unknown }),
      );

      await service.findAll(userId, listQuery({ status: TransactionStatus.DRAFT }));
      expect(doubled.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'DRAFT' }) as unknown }));
    });

    it('normalizes referenceMonth to the 1st in the where clause', async () => {
      await service.findAll(userId, listQuery({ referenceMonth: new Date('2026-03-17') }));

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ referenceMonth: new Date('2026-03-01') }) as unknown }),
      );
    });

    it('maps dateFrom/dateTo to settlementDate: { gte, lte }, only the supplied bound present', async () => {
      await service.findAll(userId, listQuery({ dateFrom: new Date('2026-03-01') }));
      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ settlementDate: { gte: new Date('2026-03-01') } }) as unknown }),
      );

      await service.findAll(userId, listQuery({ dateTo: new Date('2026-03-31') }));
      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ settlementDate: { lte: new Date('2026-03-31') } }) as unknown }),
      );
    });

    it('maps type to type: { in: [...] }', async () => {
      await service.findAll(userId, listQuery({ type: ['INCOME', 'EXPENSE'] }));

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: { in: ['INCOME', 'EXPENSE'] } }) as unknown }),
      );
    });

    it('maps search to an OR over description/notes, case-insensitive', async () => {
      await service.findAll(userId, listQuery({ search: 'coffee' }));

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ description: { contains: 'coffee', mode: 'insensitive' } }, { notes: { contains: 'coffee', mode: 'insensitive' } }],
          }) as unknown,
        }),
      );
    });

    it('orders by settlement date desc, createdAt desc, id desc, and requests limit + 1 rows', async () => {
      await service.findAll(userId, listQuery({ limit: 20 }));

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ settlementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], take: 21 }),
      );
    });

    it('falls back to newest-first when sort is undefined (defensive — the DTO default already covers real requests)', async () => {
      await service.findAll(userId, { limit: 50, sort: undefined as unknown as TransactionSort });

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ settlementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] }),
      );
    });

    it.each([
      [TransactionSort.NEWEST, [{ settlementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]],
      [TransactionSort.OLDEST, [{ settlementDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]],
      [TransactionSort.AMOUNT_HIGHEST, [{ amount: 'desc' }, { settlementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]],
      [TransactionSort.AMOUNT_LOWEST, [{ amount: 'asc' }, { settlementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]],
      [TransactionSort.DESCRIPTION, [{ description: 'asc' }, { settlementDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]],
    ] as const)('maps sort %s to orderBy %j', async (sort, orderBy) => {
      await service.findAll(userId, listQuery({ sort }));

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy }));
    });

    it('passes cursor/skip only when a cursor is supplied', async () => {
      await service.findAll(userId, listQuery({ cursor: transactionId }));
      expect(doubled.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ cursor: { id: transactionId }, skip: 1 }));

      await service.findAll(userId, listQuery());
      expect(doubled.transaction.findMany).toHaveBeenLastCalledWith(expect.not.objectContaining({ cursor: expect.anything() as unknown }));
    });

    it('returns exactly limit items and the last item id as nextCursor when the extra row comes back', async () => {
      doubled.transaction.findMany.mockResolvedValue([row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })]);

      const result = await service.findAll(userId, listQuery({ limit: 2 }));

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('b');
    });

    it('returns nextCursor: null when exactly limit rows come back', async () => {
      doubled.transaction.findMany.mockResolvedValue([row({ id: 'a' }), row({ id: 'b' })]);

      const result = await service.findAll(userId, listQuery({ limit: 2 }));

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('returns balances from the complete chronological ledger for transfers and cashbox operations, independent of the requested sort', async () => {
      doubled.transaction.findMany
        .mockResolvedValueOnce([
          row({ id: 'income', type: 'INCOME', amount: 100_000, accountId }),
          row({ id: 'expense', type: 'EXPENSE', amount: 50_000, accountId }),
          row({ id: 'transfer', type: 'TRANSFER', amount: 10_000, accountId, destinationAccountId }),
          row({ id: 'destination-expense', type: 'EXPENSE', amount: 2_000, accountId: destinationAccountId }),
          row({ id: 'cashbox-in', type: 'CASHBOX_IN', amount: 5_000, accountId }),
          row({ id: 'cashbox-out', type: 'CASHBOX_OUT', amount: 2_000, accountId }),
          row({ id: 'cashbox-transfer', type: 'CASHBOX_TRANSFER', amount: 1_000, accountId: null }),
        ])
        .mockResolvedValueOnce([
          row({ id: 'income', type: 'INCOME', amount: 100_000, accountId }),
          row({ id: 'expense', type: 'EXPENSE', amount: 50_000, accountId }),
          row({ id: 'transfer', type: 'TRANSFER', amount: 10_000, accountId, destinationAccountId }),
          row({ id: 'destination-expense', type: 'EXPENSE', amount: 2_000, accountId: destinationAccountId }),
          row({ id: 'cashbox-in', type: 'CASHBOX_IN', amount: 5_000, accountId }),
          row({ id: 'cashbox-out', type: 'CASHBOX_OUT', amount: 2_000, accountId }),
          row({ id: 'cashbox-transfer', type: 'CASHBOX_TRANSFER', amount: 1_000, accountId: null }),
        ]);
      (doubled.prisma as unknown as { account: { findMany: jest.Mock } }).account.findMany.mockResolvedValue([
        { id: accountId, initialBalance: 10_000 },
        { id: destinationAccountId, initialBalance: 0 },
      ]);

      const result = await service.findAll(userId, listQuery({ sort: TransactionSort.AMOUNT_HIGHEST }));

      expect(result.items.map(({ id, accountBalanceAfter }) => ({ id, accountBalanceAfter }))).toEqual([
        { id: 'income', accountBalanceAfter: 110_000 },
        { id: 'expense', accountBalanceAfter: 60_000 },
        { id: 'transfer', accountBalanceAfter: 50_000 },
        { id: 'destination-expense', accountBalanceAfter: 8_000 },
        { id: 'cashbox-in', accountBalanceAfter: 45_000 },
        { id: 'cashbox-out', accountBalanceAfter: 47_000 },
        { id: 'cashbox-transfer', accountBalanceAfter: null },
      ]);
      expect(doubled.transaction.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { userId, status: 'CONFIRMED' }, orderBy: [{ settlementDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
      );
    });

    it('derives total/incomeTotal/expenseTotal/cashboxInTotal/cashboxOutTotal from the groupBy result, defaulting an absent type to 0', async () => {
      doubled.transaction.groupBy.mockResolvedValue([
        { type: 'INCOME', _sum: { amount: 5_000 }, _count: { _all: 2 } },
        { type: 'EXPENSE', _sum: { amount: 1_500 }, _count: { _all: 3 } },
        { type: 'CASHBOX_IN', _sum: { amount: 2_000 }, _count: { _all: 1 } },
        { type: 'CASHBOX_OUT', _sum: { amount: 700 }, _count: { _all: 1 } },
      ]);

      const result = await service.findAll(userId, listQuery());

      expect(result.total).toBe(7);
      expect(result.incomeTotal).toBe(5_000);
      expect(result.expenseTotal).toBe(1_500);
      expect(result.cashboxInTotal).toBe(2_000);
      expect(result.cashboxOutTotal).toBe(700);
    });

    it('defaults incomeTotal/expenseTotal/cashboxInTotal/cashboxOutTotal to 0 when a type is absent from the groupBy result', async () => {
      doubled.transaction.groupBy.mockResolvedValue([{ type: 'TRANSFER', _sum: { amount: 9_000 }, _count: { _all: 1 } }]);

      const result = await service.findAll(userId, listQuery());

      expect(result.total).toBe(1);
      expect(result.incomeTotal).toBe(0);
      expect(result.expenseTotal).toBe(0);
      expect(result.cashboxInTotal).toBe(0);
      expect(result.cashboxOutTotal).toBe(0);
    });

    it('scopes both findMany and groupBy to userId', async () => {
      await service.findAll(userId, listQuery());

      expect(doubled.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId }) as unknown }));
      expect(doubled.transaction.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId }) as unknown }));
    });
  });

  describe('update', () => {
    it('rejects a type change with 400 TRANSACTION_TYPE_IMMUTABLE, without touching the row', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());

      await expect(service.update(userId, transactionId, { type: 'INCOME' })).rejects.toThrow(BadRequestException);
      expect(doubled.transaction.update).not.toHaveBeenCalled();
    });

    it('accepts a null amount on a DRAFT (ADR-0020)', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ status: TransactionStatus.DRAFT, amount: 1_000 }));
      doubled.transaction.update.mockResolvedValue(row({ status: TransactionStatus.DRAFT, amount: null }));

      await expect(service.update(userId, transactionId, { amount: null })).resolves.toMatchObject({ amount: null });
    });

    it('rejects a null amount when the transaction is already CONFIRMED, with 400 TRANSACTION_AMOUNT_REQUIRED_WHEN_CONFIRMED', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ status: TransactionStatus.CONFIRMED }));

      await expect(service.update(userId, transactionId, { amount: null })).rejects.toThrow(BadRequestException);
      expect(doubled.transaction.update).not.toHaveBeenCalled();
    });

    it('confirms a DRAFT that already has an amount when status is set to CONFIRMED', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ status: TransactionStatus.DRAFT, amount: 1_000 }));
      doubled.transaction.update.mockResolvedValue(row({ status: TransactionStatus.CONFIRMED, amount: 1_000 }));

      await expect(service.update(userId, transactionId, { status: TransactionStatus.CONFIRMED })).resolves.toMatchObject({
        status: TransactionStatus.CONFIRMED,
      });
    });

    it('rejects confirming a DRAFT that still has a null amount, with 400 TRANSACTION_AMOUNT_REQUIRED_WHEN_CONFIRMED', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ status: TransactionStatus.DRAFT, amount: null }));

      await expect(service.update(userId, transactionId, { status: TransactionStatus.CONFIRMED })).rejects.toThrow(BadRequestException);
      expect(doubled.transaction.update).not.toHaveBeenCalled();
    });

    it('confirms a DRAFT and sets its amount in the same patch', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ status: TransactionStatus.DRAFT, amount: null }));
      doubled.transaction.update.mockResolvedValue(row({ status: TransactionStatus.CONFIRMED, amount: 2_500 }));

      await expect(service.update(userId, transactionId, { amount: 2_500, status: TransactionStatus.CONFIRMED })).resolves.toMatchObject({
        status: TransactionStatus.CONFIRMED,
        amount: 2_500,
      });
    });

    it('skips the validator when the patch touches no ref field', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.update.mockResolvedValue(row({ description: 'Renamed' }));

      await service.update(userId, transactionId, { description: 'Renamed' });

      expect(doubled.validate).not.toHaveBeenCalled();
    });

    it('re-validates with the merged refs, requiring active, when a ref field is in the patch', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.update.mockResolvedValue(row());

      await service.update(userId, transactionId, { categoryId: 'new-category-id' });

      expect(doubled.validate).toHaveBeenCalledWith(
        userId,
        { type: 'EXPENSE', accountId, categoryId: 'new-category-id', subcategoryId, cashboxId: undefined, destinationCashboxId: undefined },
        { requireActive: true },
      );
    });

    it('re-validates when only destinationAccountId is in the patch, merging the current TRANSFER refs', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ type: 'TRANSFER', accountId, destinationAccountId, categoryId: null, subcategoryId: null }));
      doubled.transaction.update.mockResolvedValue(row({ type: 'TRANSFER', accountId, destinationAccountId: 'new-destination-id' }));

      await service.update(userId, transactionId, { destinationAccountId: 'new-destination-id' });

      expect(doubled.validate).toHaveBeenCalledWith(
        userId,
        {
          type: 'TRANSFER',
          accountId,
          destinationAccountId: 'new-destination-id',
          categoryId: undefined,
          subcategoryId: undefined,
          cashboxId: undefined,
          destinationCashboxId: undefined,
        },
        { requireActive: true },
      );
    });

    it('re-validates when only a cashbox ref field is in the patch, merging the current cashbox type refs', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ type: 'CASHBOX_OUT', accountId, categoryId: null, subcategoryId: null, cashboxId }));
      doubled.transaction.update.mockResolvedValue(row({ type: 'CASHBOX_OUT', cashboxId: destinationCashboxId }));

      await service.update(userId, transactionId, { cashboxId: destinationCashboxId });

      expect(doubled.validate).toHaveBeenCalledWith(
        userId,
        { type: 'CASHBOX_OUT', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId: destinationCashboxId, destinationCashboxId: undefined },
        { requireActive: true },
      );
    });

    it('re-snapshots cashboxLabel only when cashboxId itself is patched, not merely because the validator ran', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ type: 'CASHBOX_OUT', accountId, categoryId: null, subcategoryId: null, cashboxId }));
      doubled.validate.mockResolvedValue({ ...NO_REFS, cashbox: { id: cashboxId, name: 'Carro (renamed in resolve, ignored)' } });
      doubled.transaction.update.mockResolvedValue(row({ type: 'CASHBOX_OUT', cashboxId }));

      // Patch only accountId — the validator still runs (it re-checks the merged refs), but
      // cashboxId itself was not in the patch, so its label must be left untouched.
      await service.update(userId, transactionId, { accountId: destinationCashboxId });

      expect(doubled.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { accountId: destinationCashboxId, referenceMonth: new Date('2026-03-01'), settlementDate: new Date('2026-03-15') },
      });
    });

    it('skips the balance guard entirely for a patch touching no cashbox field — no groupBy query', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.update.mockResolvedValue(row({ description: 'Renamed' }));

      await service.update(userId, transactionId, { description: 'Renamed' });

      expect(doubled.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('guards the old and the new cashbox when a withdrawal is moved to a different cashbox', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ type: 'CASHBOX_OUT', accountId, categoryId: null, subcategoryId: null, cashboxId }));
      doubled.validate.mockResolvedValue({ ...NO_REFS, cashbox: { id: destinationCashboxId, name: 'Férias' } });
      doubled.transaction.update.mockResolvedValue(row({ type: 'CASHBOX_OUT', cashboxId: destinationCashboxId }));

      await service.update(userId, transactionId, { cashboxId: destinationCashboxId });

      expect(doubled.transaction.groupBy).toHaveBeenCalledTimes(2);
      const calls = doubled.transaction.groupBy.mock.calls as [{ where: { OR: { cashboxId?: { in: string[] } }[] } }][];
      const idsQueried = calls[0]![0].where.OR.flatMap((clause) => clause.cashboxId?.in ?? []);
      expect(idsQueried).toEqual(expect.arrayContaining([cashboxId, destinationCashboxId]) as unknown);
    });

    it('preserves settlement and referenceMonth on a credit-card purchase date change', async () => {
      doubled.transaction.findUnique.mockResolvedValue(
        row({ isCreditCard: true, referenceMonth: new Date('2026-05-01'), settlementDate: new Date('2026-05-01') }),
      );
      doubled.transaction.update.mockResolvedValue(row({ isCreditCard: true }));

      await service.update(userId, transactionId, { date: new Date('2026-04-01') });

      expect(doubled.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { date: new Date('2026-04-01'), referenceMonth: new Date('2026-05-01'), settlementDate: new Date('2026-05-01') },
      });
    });

    it('derives referenceMonth when a card settlement date changes and rejects an earlier settlement', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ isCreditCard: true }));
      doubled.transaction.update.mockResolvedValue(row({ isCreditCard: true }));

      await service.update(userId, transactionId, { settlementDate: new Date('2026-04-20') });

      expect(doubled.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { settlementDate: new Date('2026-04-20'), referenceMonth: new Date('2026-04-01') },
      });
      await expect(service.update(userId, transactionId, { settlementDate: new Date('2026-03-14') })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_SETTLEMENT_BEFORE_DATE' },
      });
    });

    it('recomputes referenceMonth on a non-credit-card date change', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.update.mockResolvedValue(row());

      await service.update(userId, transactionId, { date: new Date('2026-04-05') });

      expect(doubled.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { date: new Date('2026-04-05'), referenceMonth: new Date('2026-04-01'), settlementDate: new Date('2026-04-05') },
      });
    });
  });

  describe('remove', () => {
    it('deletes for real, permanently', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.delete.mockResolvedValue(row());

      await service.remove(userId, transactionId);

      expect(doubled.transaction.delete).toHaveBeenCalledWith({ where: { id: transactionId } });
    });

    it('skips the balance guard for a transaction with no cashbox — no groupBy query', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.delete.mockResolvedValue(row());

      await service.remove(userId, transactionId);

      expect(doubled.transaction.groupBy).not.toHaveBeenCalled();
    });

    it('rejects deleting a CASHBOX_IN that already funded a withdrawal, with 409 CASHBOX_INSUFFICIENT_FUNDS', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ type: 'CASHBOX_IN', cashboxId }));
      // After the delete, only the CASHBOX_OUT remains — the cashbox goes negative.
      doubled.transaction.groupBy.mockResolvedValue([{ type: 'CASHBOX_OUT', cashboxId, destinationCashboxId: null, _sum: { amount: 1_000 } }]);
      doubled.transaction.delete.mockResolvedValue(row({ type: 'CASHBOX_IN', cashboxId }));

      await expect(service.remove(userId, transactionId)).rejects.toThrow(ConflictException);
    });
  });

  describe('ownership', () => {
    it.each([
      ['findOne', () => service.findOne(userId, transactionId)],
      ['update', () => service.update(userId, transactionId, { description: 'Renamed' })],
      ['remove', () => service.remove(userId, transactionId)],
    ])("answers 404, not 403, when %s hits another user's transaction", async (_name, call) => {
      doubled.transaction.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(call()).rejects.toThrow(NotFoundException);
      expect(doubled.transaction.update).not.toHaveBeenCalled();
      expect(doubled.transaction.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      doubled.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, transactionId)).rejects.toThrow(NotFoundException);
    });
  });
});

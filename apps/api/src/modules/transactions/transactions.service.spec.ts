import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { TransactionStatus, TransactionSource, type Transaction } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

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
  transaction: Record<'findUnique' | 'create' | 'update' | 'delete' | 'groupBy', jest.Mock>;
  validate: jest.Mock;
} => {
  const transaction = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), groupBy: jest.fn().mockResolvedValue([]) };
  const $transaction = jest.fn((fn: (tx: { transaction: typeof transaction }) => unknown) => fn({ transaction }));
  const validate = jest.fn().mockResolvedValue(NO_REFS);

  return {
    prisma: { transaction, $transaction } as unknown as PrismaService,
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
        data: { ...dto, userId, referenceMonth: new Date('2026-03-01'), cashboxLabel: null, destinationCashboxLabel: null },
      });
    });

    it('normalizes an explicit referenceMonth to the 1st', async () => {
      doubled.transaction.create.mockResolvedValue(row());

      const dto = { type: 'EXPENSE' as const, amount: 1_000, date: new Date('2026-03-15'), referenceMonth: new Date('2026-04-15'), description: 'Coffee' };

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
        data: { ...dto, userId, referenceMonth: new Date('2026-03-01'), cashboxLabel: 'Carro', destinationCashboxLabel: 'Férias' },
      });
    });

    it('creates a TRANSFER with destinationAccountId and no cashbox — no groupBy query', async () => {
      doubled.transaction.create.mockResolvedValue(row({ type: 'TRANSFER', accountId, destinationAccountId, categoryId: null, subcategoryId: null }));

      const dto = { type: 'TRANSFER' as const, amount: 1_000, date: new Date('2026-03-15'), description: 'Move', accountId, destinationAccountId };

      await service.create(userId, dto);

      expect(doubled.transaction.create).toHaveBeenCalledWith({
        data: { ...dto, userId, referenceMonth: new Date('2026-03-01'), cashboxLabel: null, destinationCashboxLabel: null },
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

  describe('update', () => {
    it('rejects a type change with 400 TRANSACTION_TYPE_IMMUTABLE, without touching the row', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());

      await expect(service.update(userId, transactionId, { type: 'INCOME' })).rejects.toThrow(BadRequestException);
      expect(doubled.transaction.update).not.toHaveBeenCalled();
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
        data: { accountId: destinationCashboxId, referenceMonth: new Date('2026-03-01') },
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

    it('preserves referenceMonth on a credit-card date change', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row({ isCreditCard: true }));
      doubled.transaction.update.mockResolvedValue(row({ isCreditCard: true }));

      await service.update(userId, transactionId, { date: new Date('2026-04-01') });

      expect(doubled.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { date: new Date('2026-04-01'), referenceMonth: new Date('2026-03-01') },
      });
    });

    it('recomputes referenceMonth on a non-credit-card date change', async () => {
      doubled.transaction.findUnique.mockResolvedValue(row());
      doubled.transaction.update.mockResolvedValue(row());

      await service.update(userId, transactionId, { date: new Date('2026-04-05') });

      expect(doubled.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: { date: new Date('2026-04-05'), referenceMonth: new Date('2026-04-01') },
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

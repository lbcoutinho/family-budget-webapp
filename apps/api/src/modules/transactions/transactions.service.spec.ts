import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TransactionStatus, TransactionSource, type Transaction } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { TransactionsService } from './transactions.service';
import { type TransactionValidator } from './validators/transaction-validator';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const transactionId = '33333333-3333-3333-3333-333333333333';
const accountId = '44444444-4444-4444-4444-444444444444';
const categoryId = '55555555-5555-5555-5555-555555555555';
const subcategoryId = '66666666-6666-6666-6666-666666666666';

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

const doubles = (): {
  prisma: PrismaService;
  validator: TransactionValidator;
  transaction: Record<'findUnique' | 'create' | 'update' | 'delete', jest.Mock>;
  validate: jest.Mock;
} => {
  const transaction = { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const validate = jest.fn().mockResolvedValue({});

  return { prisma: { transaction } as unknown as PrismaService, validator: { validate } as unknown as TransactionValidator, transaction, validate };
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
      expect(doubled.transaction.create).toHaveBeenCalledWith({ data: { ...dto, userId, referenceMonth: new Date('2026-03-01') } });
    });

    it('normalizes an explicit referenceMonth to the 1st', async () => {
      doubled.transaction.create.mockResolvedValue(row());

      const dto = { type: 'EXPENSE' as const, amount: 1_000, date: new Date('2026-03-15'), referenceMonth: new Date('2026-04-15'), description: 'Coffee' };

      await service.create(userId, dto);

      expect(doubled.transaction.create).toHaveBeenCalledWith({ data: { ...dto, userId, referenceMonth: new Date('2026-04-01') } });
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
        { type: 'EXPENSE', accountId, categoryId: 'new-category-id', subcategoryId },
        { requireActive: true },
      );
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

  it('deletes for real, permanently', async () => {
    doubled.transaction.findUnique.mockResolvedValue(row());
    doubled.transaction.delete.mockResolvedValue(row());

    await service.remove(userId, transactionId);

    expect(doubled.transaction.delete).toHaveBeenCalledWith({ where: { id: transactionId } });
  });
});

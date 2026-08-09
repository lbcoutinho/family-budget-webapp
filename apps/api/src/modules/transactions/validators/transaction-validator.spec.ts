import { BadRequestException, NotFoundException } from '@nestjs/common';

import { type Account, type Cashbox, type Category, CategoryKind, type TransactionType } from '../../../generated/prisma/client';
import { type PrismaService } from '../../../prisma/prisma.service';

import { TRANSACTION_REF_FIELDS, type TransactionRefField, type TransactionRefInput, TransactionValidator } from './transaction-validator';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';

const accountId = '33333333-3333-3333-3333-333333333333';
const destinationAccountId = '44444444-4444-4444-4444-444444444444';
const categoryId = '55555555-5555-5555-5555-555555555555';
const subcategoryId = '66666666-6666-6666-6666-666666666666';
const cashboxId = '77777777-7777-7777-7777-777777777777';
const destinationCashboxId = '88888888-8888-8888-8888-888888888888';
const otherRootId = '99999999-9999-9999-9999-999999999999';

const account = (overrides: Partial<Account> = {}): Account => ({
  id: accountId,
  userId,
  name: 'Conta corrente',
  initialBalance: 0,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const cashbox = (overrides: Partial<Cashbox> = {}): Cashbox => ({
  id: cashboxId,
  userId,
  name: 'Cofrinho',
  description: null,
  targetAmount: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const category = (overrides: Partial<Category> = {}): Category => ({
  id: categoryId,
  userId,
  parentId: null,
  name: 'Mercado',
  kind: CategoryKind.EXPENSE,
  color: '#a85c1a',
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

/** The minimal valid ref input for each transaction type, per the M4-T02 rule table. */
const MINIMAL_INPUT: Record<TransactionType, TransactionRefInput> = {
  INCOME: { type: 'INCOME', accountId, categoryId, subcategoryId },
  EXPENSE: { type: 'EXPENSE', accountId, categoryId, subcategoryId },
  TRANSFER: { type: 'TRANSFER', accountId, destinationAccountId },
  CASHBOX_IN: { type: 'CASHBOX_IN', accountId, cashboxId },
  CASHBOX_OUT: { type: 'CASHBOX_OUT', accountId, cashboxId },
  CASHBOX_TRANSFER: { type: 'CASHBOX_TRANSFER', cashboxId, destinationCashboxId },
};

type Delegate = Record<'findMany', jest.Mock>;

const prismaDouble = (): { prisma: PrismaService; account: Delegate; cashbox: Delegate; category: Delegate } => {
  const account: Delegate = { findMany: jest.fn().mockResolvedValue([]) };
  const cashbox: Delegate = { findMany: jest.fn().mockResolvedValue([]) };
  const category: Delegate = { findMany: jest.fn().mockResolvedValue([]) };

  return { prisma: { account, cashbox, category } as unknown as PrismaService, account, cashbox, category };
};

describe('TransactionValidator', () => {
  let validator: TransactionValidator;
  let accountDelegate: Delegate;
  let cashboxDelegate: Delegate;
  let categoryDelegate: Delegate;

  beforeEach(() => {
    const double = prismaDouble();

    accountDelegate = double.account;
    cashboxDelegate = double.cashbox;
    categoryDelegate = double.category;
    validator = new TransactionValidator(double.prisma);

    accountDelegate.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve([account(), account({ id: destinationAccountId, name: 'Poupança' })].filter((row) => where.id.in.includes(row.id))),
    );
    cashboxDelegate.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve([cashbox(), cashbox({ id: destinationCashboxId, name: 'Viagem' })].filter((row) => where.id.in.includes(row.id))),
    );
    categoryDelegate.findMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
      Promise.resolve([category(), category({ id: subcategoryId, name: 'Supermercado', parentId: categoryId })].filter((row) => where.id.in.includes(row.id))),
    );
  });

  describe('happy path', () => {
    it.each(Object.entries(MINIMAL_INPUT))('accepts a minimal valid %s', async (type, input) => {
      if (type === 'INCOME') {
        categoryDelegate.findMany.mockResolvedValue([
          category({ kind: CategoryKind.INCOME }),
          category({ id: subcategoryId, parentId: categoryId, kind: CategoryKind.INCOME }),
        ]);
      }

      await expect(validator.validate(userId, input, { requireActive: true })).resolves.toBeDefined();
    });

    it('resolves both cashbox rows for CASHBOX_TRANSFER, so the caller can snapshot labels', async () => {
      const refs = await validator.validate(userId, MINIMAL_INPUT.CASHBOX_TRANSFER, { requireActive: true });

      expect(refs.cashbox?.id).toBe(cashboxId);
      expect(refs.destinationCashbox?.id).toBe(destinationCashboxId);
    });
  });

  describe('shape', () => {
    const cases: [TransactionType, TransactionRefField][] = Object.keys(MINIMAL_INPUT).flatMap((type) =>
      TRANSACTION_REF_FIELDS.map((field) => [type as TransactionType, field] as [TransactionType, TransactionRefField]),
    );

    it.each(cases)('%s: missing or extra %s is rejected, naming the field', async (type, field) => {
      const input = MINIMAL_INPUT[type];
      const isRequired = input[field] !== undefined;

      const variant: TransactionRefInput = isRequired
        ? { ...input, [field]: undefined }
        : { ...input, [field]: field.includes('account') ? accountId : field.includes('cashbox') ? cashboxId : categoryId };

      const expectedCode = isRequired ? 'TRANSACTION_FIELD_REQUIRED' : 'TRANSACTION_FIELD_NOT_ALLOWED';

      await expect(validator.validate(userId, variant, { requireActive: true })).rejects.toMatchObject({
        response: { code: expectedCode, message: expect.stringContaining(field) as string },
      });
    });
  });

  describe('distinctness', () => {
    it('rejects destinationAccountId === accountId on TRANSFER', async () => {
      await expect(validator.validate(userId, { ...MINIMAL_INPUT.TRANSFER, destinationAccountId: accountId }, { requireActive: true })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_SAME_ACCOUNT' },
      });
    });

    it('rejects destinationCashboxId === cashboxId on CASHBOX_TRANSFER', async () => {
      await expect(
        validator.validate(userId, { ...MINIMAL_INPUT.CASHBOX_TRANSFER, destinationCashboxId: cashboxId }, { requireActive: true }),
      ).rejects.toMatchObject({ response: { code: 'TRANSACTION_SAME_CASHBOX' } });
    });
  });

  describe('ownership', () => {
    it('treats a row belonging to another user as 404, same as a nonexistent id', async () => {
      accountDelegate.findMany.mockResolvedValue([]);

      await expect(validator.validate(otherUserId, MINIMAL_INPUT.CASHBOX_IN, { requireActive: true })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('active', () => {
    it.each([
      ['account', () => accountDelegate.findMany.mockResolvedValue([account({ isActive: false })])],
      ['cashbox', () => cashboxDelegate.findMany.mockResolvedValue([cashbox({ isActive: false })])],
    ])('rejects an inactive %s under requireActive: true, accepts it under false', async (_name, deactivate: () => void) => {
      deactivate();

      await expect(validator.validate(userId, MINIMAL_INPUT.CASHBOX_IN, { requireActive: true })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_REFERENCE_INACTIVE' },
      });
      await expect(validator.validate(userId, MINIMAL_INPUT.CASHBOX_IN, { requireActive: false })).resolves.toBeDefined();
    });

    it('rejects an inactive category or subcategory under requireActive: true, accepts under false', async () => {
      categoryDelegate.findMany.mockResolvedValue([category({ isActive: false }), category({ id: subcategoryId, parentId: categoryId })]);

      await expect(validator.validate(userId, MINIMAL_INPUT.EXPENSE, { requireActive: true })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_REFERENCE_INACTIVE' },
      });
      await expect(validator.validate(userId, MINIMAL_INPUT.EXPENSE, { requireActive: false })).resolves.toBeDefined();
    });
  });

  describe('category kind', () => {
    it('rejects INCOME with an EXPENSE category', async () => {
      await expect(validator.validate(userId, MINIMAL_INPUT.INCOME, { requireActive: true })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_CATEGORY_KIND_MISMATCH' },
      });
    });

    it('rejects EXPENSE with an INCOME category', async () => {
      categoryDelegate.findMany.mockResolvedValue([
        category({ kind: CategoryKind.INCOME }),
        category({ id: subcategoryId, parentId: categoryId, kind: CategoryKind.INCOME }),
      ]);

      await expect(validator.validate(userId, MINIMAL_INPUT.EXPENSE, { requireActive: true })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_CATEGORY_KIND_MISMATCH' },
      });
    });
  });

  describe('subcategory parent', () => {
    it('rejects a subcategory whose parentId is a different root', async () => {
      categoryDelegate.findMany.mockResolvedValue([category(), category({ id: subcategoryId, parentId: otherRootId })]);

      await expect(validator.validate(userId, MINIMAL_INPUT.EXPENSE, { requireActive: true })).rejects.toMatchObject({
        response: { code: 'TRANSACTION_SUBCATEGORY_PARENT_MISMATCH' },
      });
    });
  });

  describe('query count', () => {
    it('runs one findMany per referenced entity type', async () => {
      categoryDelegate.findMany.mockResolvedValue([
        category({ kind: CategoryKind.INCOME }),
        category({ id: subcategoryId, parentId: categoryId, kind: CategoryKind.INCOME }),
      ]);

      await validator.validate(userId, MINIMAL_INPUT.INCOME, { requireActive: true });

      expect(accountDelegate.findMany).toHaveBeenCalledTimes(1);
      expect(categoryDelegate.findMany).toHaveBeenCalledTimes(1);
      expect(cashboxDelegate.findMany).toHaveBeenCalledTimes(0);
    });
  });

  it('rejects a non-uuid ownership mismatch consistently as BadRequestException for shape errors', async () => {
    await expect(validator.validate(userId, { type: 'TRANSFER' }, { requireActive: true })).rejects.toBeInstanceOf(BadRequestException);
  });
});

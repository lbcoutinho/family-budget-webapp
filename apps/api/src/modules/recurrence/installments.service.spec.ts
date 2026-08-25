import { BadRequestException, NotFoundException } from '@nestjs/common';

import { type PrismaService } from '../../prisma/prisma.service';
import { type TransactionValidator } from '../transactions/validators/transaction-validator';

import { type CreateInstallmentPlanDto } from './dto/create-installment-plan.dto';
import { InstallmentsService } from './installments.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const ruleId = '33333333-3333-3333-3333-333333333333';
const accountId = '44444444-4444-4444-4444-444444444444';
const categoryId = '55555555-5555-5555-5555-555555555555';

const validDto = (overrides: Partial<CreateInstallmentPlanDto> = {}): CreateInstallmentPlanDto => ({
  totalAmount: 10_000,
  installments: 3,
  firstPaymentDate: new Date('2026-01-31T00:00:00.000Z'),
  purchaseDate: new Date('2026-01-15T00:00:00.000Z'),
  description: 'New sofa',
  accountId,
  categoryId,
  ...overrides,
});

interface TxDouble {
  recurrenceRule: { create: jest.Mock; update: jest.Mock };
  transaction: { createMany: jest.Mock; findMany: jest.Mock; deleteMany: jest.Mock };
}

const setup = (): { service: InstallmentsService; prisma: PrismaService; tx: TxDouble; validate: jest.Mock; findUnique: jest.Mock } => {
  const tx: TxDouble = {
    recurrenceRule: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        id: ruleId,
        userId,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...data,
      })),
      update: jest.fn(),
    },
    transaction: {
      createMany: jest.fn(({ data }: { data: Record<string, unknown>[] }) => ({ count: data.length })),
      findMany: jest.fn(() => []),
      deleteMany: jest.fn(() => ({ count: 0 })),
    },
  };

  // `createMany` snapshots the rows it was given (filling in the columns Prisma would default),
  // and `findMany` echoes them back — a double for Prisma's storage, not a re-implementation of it.
  let lastCreateManyRows: Record<string, unknown>[] = [];

  tx.transaction.createMany.mockImplementation(({ data }: { data: Record<string, unknown>[] }) => {
    lastCreateManyRows = data.map((row, index) => ({
      id: `installment-${index + 1}`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      destinationAccountId: null,
      cashboxId: null,
      destinationCashboxId: null,
      cashboxLabel: null,
      destinationCashboxLabel: null,
      ...row,
    }));

    return { count: data.length };
  });

  tx.transaction.findMany.mockImplementation(() => lastCreateManyRows);

  const findUnique = jest.fn();
  const prisma = {
    $transaction: jest.fn((cb: (tx: TxDouble) => unknown) => cb(tx)),
    recurrenceRule: { findUnique },
  } as unknown as PrismaService;

  const validate = jest.fn().mockResolvedValue({});
  const service = new InstallmentsService(prisma, { validate } as unknown as TransactionValidator);

  return { service, prisma, tx, validate, findUnique };
};

describe('InstallmentsService.createPlan', () => {
  it('keeps the description and sets installmentNumber/installmentTotal', async () => {
    const { service } = setup();

    const result = await service.createPlan(userId, validDto({ installments: 3, description: 'New sofa' }));

    expect(result.installments.map((i) => i.description)).toEqual(['New sofa', 'New sofa', 'New sofa']);
    expect(result.installments.map((i) => i.installmentNumber)).toEqual([1, 2, 3]);
    expect(result.installments.every((i) => i.installmentTotal === 3)).toBe(true);
  });

  it('leaves notes empty on every installment', async () => {
    const { service } = setup();

    const result = await service.createPlan(userId, validDto({ purchaseDate: new Date('2026-02-20T00:00:00.000Z') }));

    expect(result.installments.every((i) => i.notes === null)).toBe(true);
  });

  it('splits €100.00 across 3 installments as 3333 / 3333 / 3334', async () => {
    const { service } = setup();

    const result = await service.createPlan(userId, validDto({ totalAmount: 10_000, installments: 3 }));

    expect(result.installments.map((i) => i.amount)).toEqual([3_333, 3_333, 3_334]);
    expect(result.rule.totalAmount).toBe(10_000);
  });

  it('clamps a plan starting on the 31st to the 28th in February (non-leap year)', async () => {
    const { service } = setup();

    const result = await service.createPlan(userId, validDto({ firstPaymentDate: new Date('2027-01-31T00:00:00.000Z'), installments: 2 }));

    expect(result.installments.map((i) => i.date)).toEqual(['2027-01-31', '2027-02-28']);
    expect(result.installments.map((i) => i.referenceMonth)).toEqual(['2027-01-01', '2027-02-01']);
  });

  it('maps autoConfirm to CONFIRMED by default, and DRAFT when explicitly false', async () => {
    const { service } = setup();

    const confirmed = await service.createPlan(userId, validDto());
    expect(confirmed.installments.every((i) => i.status === 'CONFIRMED')).toBe(true);

    const draft = await service.createPlan(userId, validDto({ autoConfirm: false }));
    expect(draft.installments.every((i) => i.status === 'DRAFT')).toBe(true);
  });

  it('sets source RECURRING and the plan recurrenceRuleId on every row, and generatedUntil on the rule', async () => {
    const { service } = setup();

    const result = await service.createPlan(userId, validDto());

    expect(result.installments.every((i) => i.source === 'RECURRING')).toBe(true);
    expect(result.installments.every((i) => i.recurrenceRuleId === ruleId)).toBe(true);
    expect(result.rule.generatedUntil).toBe(result.installments.at(-1)!.date);
  });

  it('validates references before writing anything', async () => {
    const { service, validate, prisma } = setup();
    validate.mockRejectedValueOnce(new BadRequestException());

    await expect(service.createPlan(userId, validDto())).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects totalAmount below installments', async () => {
    const { service } = setup();

    await expect(service.createPlan(userId, validDto({ totalAmount: 2, installments: 3 }))).rejects.toThrow(BadRequestException);
  });
});

describe('InstallmentsService.cancelPlan', () => {
  it('404s when the rule is missing or belongs to another user', async () => {
    const { service, findUnique } = setup();
    findUnique.mockResolvedValue(null);
    await expect(service.cancelPlan(userId, ruleId)).rejects.toThrow(NotFoundException);

    findUnique.mockResolvedValue({ id: ruleId, userId: otherUserId, totalOccurrences: 3 });
    await expect(service.cancelPlan(userId, ruleId)).rejects.toThrow(NotFoundException);
  });

  it('400s on an open-ended rule (totalOccurrences = null)', async () => {
    const { service, findUnique } = setup();
    findUnique.mockResolvedValue({ id: ruleId, userId, totalOccurrences: null });

    await expect(service.cancelPlan(userId, ruleId)).rejects.toThrow(BadRequestException);
  });

  it('deletes installments dated after today regardless of status and deactivates the rule', async () => {
    const { service, findUnique, tx } = setup();
    findUnique.mockResolvedValue({ id: ruleId, userId, totalOccurrences: 3 });
    tx.transaction.deleteMany.mockResolvedValue({ count: 2 });

    const result = await service.cancelPlan(userId, ruleId);

    expect(result).toEqual({ deleted: 2 });
    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({
      where: { recurrenceRuleId: ruleId, date: { gt: expect.any(Date) as Date } },
    });
    expect(tx.recurrenceRule.update).toHaveBeenCalledWith({ where: { id: ruleId }, data: { isActive: false } });
  });
});

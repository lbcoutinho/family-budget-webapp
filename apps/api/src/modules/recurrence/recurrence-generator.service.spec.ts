import { type Prisma, type RecurrenceRule } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { RecurrenceGeneratorService } from './recurrence-generator.service';

const userId = '11111111-1111-1111-1111-111111111111';
const ruleId = '33333333-3333-3333-3333-333333333333';

const rule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  id: ruleId,
  userId,
  type: 'EXPENSE',
  amount: null,
  description: 'Electricity bill',
  notes: null,
  accountId: null,
  categoryId: null,
  subcategoryId: null,
  frequency: 'MONTHLY',
  interval: 1,
  dayOfMonth: 15,
  startDate: new Date('2026-01-15T00:00:00.000Z'),
  endDate: null,
  totalOccurrences: null,
  totalAmount: null,
  autoConfirm: false,
  isActive: true,
  generatedUntil: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

function setup(alreadyGenerated = 0) {
  const count = jest.fn().mockResolvedValue(alreadyGenerated);
  const createMany = jest.fn().mockImplementation((args: { data: Prisma.TransactionCreateManyInput[] }) => Promise.resolve({ count: args.data.length }));
  const recurrenceRuleUpdate = jest.fn();
  interface Tx {
    transaction: { count: jest.Mock; createMany: jest.Mock };
    recurrenceRule: { update: jest.Mock };
  }
  const tx: Tx = { transaction: { count, createMany }, recurrenceRule: { update: recurrenceRuleUpdate } };
  const $transaction = jest.fn((callback: (tx: Tx) => unknown) => callback(tx));

  const prisma = { $transaction } as unknown as PrismaService;
  const service = new RecurrenceGeneratorService(prisma);

  return { service, count, createMany, recurrenceRuleUpdate };
}

describe('RecurrenceGeneratorService', () => {
  it('materializes a DRAFT transaction with amount: null for an amountless, non-auto-confirming rule (ADR-0020)', async () => {
    const { service, createMany } = setup();

    const result = await service.generate(userId, rule(), new Date('2026-01-31T00:00:00.000Z'));

    expect(result.created).toBe(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          amount: null,
          status: 'DRAFT',
          date: new Date('2026-01-15T00:00:00.000Z'),
          settlementDate: new Date('2026-01-15T00:00:00.000Z'),
          referenceMonth: new Date('2026-01-01T00:00:00.000Z'),
        }) as unknown,
      ],
      skipDuplicates: true,
    });
  });

  it('re-running the generator after generatedUntil already covers the horizon creates nothing new', async () => {
    const { service, createMany, recurrenceRuleUpdate } = setup();

    const result = await service.generate(userId, rule({ generatedUntil: new Date('2026-01-15T00:00:00.000Z') }), new Date('2026-01-31T00:00:00.000Z'));

    expect(result.created).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
    expect(recurrenceRuleUpdate).not.toHaveBeenCalled();
  });
});

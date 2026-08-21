import { type Prisma, type RecurrenceRule } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { RecurrenceCatchUpService } from './recurrence-catch-up.service';
import { type RecurrenceGeneratorService } from './recurrence-generator.service';

const userId = '11111111-1111-1111-1111-111111111111';
const ruleId1 = '33333333-3333-3333-3333-333333333333';
const ruleId2 = '44444444-4444-4444-4444-444444444444';

const rule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  id: ruleId1,
  userId,
  type: 'EXPENSE',
  amount: 1_000,
  description: 'Rent',
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
  autoConfirm: true,
  isActive: true,
  generatedUntil: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

function setup(options: { locked?: boolean; rules?: RecurrenceRule[] } = {}) {
  const findMany = jest.fn().mockResolvedValue(options.rules ?? [rule()]);
  const queryRaw = jest.fn().mockImplementation((query: { strings: string[] }) => {
    const sql = query.strings.join('?');
    if (sql.includes('pg_try_advisory_lock')) {
      return Promise.resolve([{ locked: options.locked ?? true }]);
    }
    return Promise.resolve([]);
  });

  const prisma = { recurrenceRule: { findMany }, $queryRaw: queryRaw } as unknown as PrismaService;
  const generate = jest.fn().mockResolvedValue({ created: 1, generatedUntil: new Date('2026-04-30T00:00:00.000Z') });
  const generator = { generate } as unknown as RecurrenceGeneratorService;

  const service = new RecurrenceCatchUpService(prisma, generator);

  return { service, findMany, queryRaw, generate };
}

describe('RecurrenceCatchUpService', () => {
  it('generates every candidate rule and reports created/rulesProcessed', async () => {
    const { service, generate } = setup({ rules: [rule({ id: ruleId1 }), rule({ id: ruleId2 })] });

    const result = await service.runForUser(userId);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ rulesProcessed: 2, created: 2, failed: [], skippedLocked: false });
  });

  it('continues past a throwing rule and reports it in failed[]', async () => {
    const { service, generate } = setup({ rules: [rule({ id: ruleId1 }), rule({ id: ruleId2 })] });

    generate.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ created: 1, generatedUntil: null });

    const result = await service.runForUser(userId);

    expect(result.rulesProcessed).toBe(2);
    expect(result.created).toBe(1);
    expect(result.failed).toEqual([{ ruleId: ruleId1, message: 'boom' }]);
  });

  it('refuses to run when the advisory lock is already held, without calling the generator', async () => {
    const { service, generate } = setup({ locked: false });

    const result = await service.runForUser(userId);

    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({ rulesProcessed: 0, created: 0, failed: [], skippedLocked: true });
  });

  it('releases the lock even when generation throws', async () => {
    const { service, queryRaw, generate } = setup({ rules: [rule()] });

    generate.mockRejectedValueOnce(new Error('boom'));

    await service.runForUser(userId);

    const unlockCalls = queryRaw.mock.calls.filter(([query]) => (query as { strings: string[] }).strings.join('?').includes('pg_advisory_unlock'));
    expect(unlockCalls).toHaveLength(1);
  });

  it('excludes inactive and ended rules via the query filter', async () => {
    const { service, findMany } = setup({ rules: [] });

    await service.runForUser(userId);

    const [args] = findMany.mock.calls[0] as [{ where: Prisma.RecurrenceRuleWhereInput }];
    expect(args.where.userId).toBe(userId);
    expect(args.where.isActive).toBe(true);
    expect(args.where.OR).toContainEqual({ endDate: null });
    expect(args.where.OR).toContainEqual({ endDate: { gte: expect.any(Date) as Date } });
  });
});

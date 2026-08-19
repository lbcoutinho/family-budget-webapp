import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validate } from '../../src/config/env.validation';
import { type Prisma, type RecurrenceRule } from '../../src/generated/prisma/client';
import { RecurrenceGeneratorService } from '../../src/modules/recurrence/recurrence-generator.service';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for `RecurrenceGeneratorService` (M7-T02), against a real database and a
 * real interactive `$transaction` — the point of this suite is the atomicity and idempotency
 * guarantees ADR-0014 calls for, which a mocked Prisma client can't exercise honestly.
 *
 * Same minimal graph as `recurrence-rule.e2e-spec.ts`: `ConfigModule` + `PrismaModule`, no HTTP
 * layer — this service has no controller in M7-T02 (#197 adds one).
 */
describe('RecurrenceGeneratorService (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: RecurrenceGeneratorService;
  let userId: string;
  let accountId: string;
  let categoryId: string;

  const email = 'recurrence-generator.e2e@family-budget.test';

  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email } } });
    await prisma.recurrenceRule.deleteMany({ where: { user: { email } } });
    await prisma.category.deleteMany({ where: { user: { email } } });
    await prisma.account.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env', '../../.env'] }), PrismaModule],
      providers: [RecurrenceGeneratorService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(RecurrenceGeneratorService);

    await moduleRef.init();
  });

  beforeEach(async () => {
    await removeFixtures();

    const user = await prisma.user.create({ data: { email, name: 'Test User', passwordHash: 'not-a-real-hash' }, select: { id: true } });
    userId = user.id;

    const [account, category] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Millennium' }, select: { id: true } }),
      prisma.category.create({ data: { userId, name: 'Casa', kind: 'EXPENSE' }, select: { id: true } }),
    ]);
    accountId = account.id;
    categoryId = category.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await moduleRef.close();
  });

  const createRule = (overrides: Partial<Prisma.RecurrenceRuleUncheckedCreateInput> = {}): Promise<RecurrenceRule> =>
    prisma.recurrenceRule.create({
      data: {
        userId,
        type: 'EXPENSE',
        amount: 5_000,
        description: 'Seguro de casa',
        accountId,
        categoryId,
        frequency: 'MONTHLY',
        dayOfMonth: 10,
        startDate: new Date('2026-01-10'),
        ...overrides,
      },
    });

  it('generates one transaction per occurrence and advances generatedUntil', async () => {
    const rule = await createRule();

    const result = await service.generate(userId, rule, new Date('2026-03-10'));

    expect(result).toEqual({ created: 3, generatedUntil: new Date('2026-03-10') });

    const rows = await prisma.transaction.findMany({ where: { recurrenceRuleId: rule.id }, orderBy: { date: 'asc' } });
    expect(rows.map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2026-01-10', '2026-02-10', '2026-03-10']);
    expect(rows.map((r) => r.referenceMonth.toISOString().slice(0, 10))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(rows.every((r) => r.source === 'RECURRING')).toBe(true);
    expect(rows.every((r) => r.amount === 5_000 && r.description === 'Seguro de casa')).toBe(true);
  });

  it('running twice in a row produces no duplicates', async () => {
    const rule = await createRule();

    await service.generate(userId, rule, new Date('2026-03-10'));
    const updatedRule = await prisma.recurrenceRule.findUniqueOrThrow({ where: { id: rule.id } });
    const second = await service.generate(userId, updatedRule, new Date('2026-03-10'));

    expect(second.created).toBe(0);

    const rows = await prisma.transaction.findMany({ where: { recurrenceRuleId: rule.id } });
    expect(rows).toHaveLength(3);
  });

  it('dayOfMonth = 31 falls back to the 28th in a non-leap February and the 30th in April', async () => {
    const rule = await createRule({ dayOfMonth: 31, startDate: new Date('2027-01-31') });

    await service.generate(userId, rule, new Date('2027-04-30'));

    const rows = await prisma.transaction.findMany({ where: { recurrenceRuleId: rule.id }, orderBy: { date: 'asc' } });
    expect(rows.map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('stops at endDate', async () => {
    const rule = await createRule({ endDate: new Date('2026-02-10') });

    const result = await service.generate(userId, rule, new Date('2026-06-10'));

    expect(result.created).toBe(2);
    expect(result.generatedUntil).toEqual(new Date('2026-02-10'));
  });

  it('caps at totalOccurrences across two runs', async () => {
    const rule = await createRule({ totalOccurrences: 3 });

    await service.generate(userId, rule, new Date('2026-01-10'));
    const afterFirst = await prisma.recurrenceRule.findUniqueOrThrow({ where: { id: rule.id } });

    const second = await service.generate(userId, afterFirst, new Date('2026-12-10'));

    expect(second.created).toBe(2);

    const rows = await prisma.transaction.findMany({ where: { recurrenceRuleId: rule.id } });
    expect(rows).toHaveLength(3);
  });

  it('an inactive rule generates nothing and does not advance generatedUntil', async () => {
    const rule = await createRule({ isActive: false });

    const result = await service.generate(userId, rule, new Date('2026-06-10'));

    expect(result).toEqual({ created: 0, generatedUntil: null });
    await expect(prisma.transaction.count({ where: { recurrenceRuleId: rule.id } })).resolves.toBe(0);
  });

  it("editing a rule's amount leaves already-generated entries unchanged", async () => {
    const rule = await createRule();
    await service.generate(userId, rule, new Date('2026-01-10'));

    await prisma.recurrenceRule.update({ where: { id: rule.id }, data: { amount: 9_999, description: 'Changed' } });

    const row = await prisma.transaction.findFirstOrThrow({ where: { recurrenceRuleId: rule.id } });
    expect(row).toMatchObject({ amount: 5_000, description: 'Seguro de casa' });
  });

  it('autoConfirm = false produces DRAFT entries; true produces CONFIRMED', async () => {
    const draftRule = await createRule({ autoConfirm: false });
    const confirmedRule = await createRule({ autoConfirm: true });

    await service.generate(userId, draftRule, new Date('2026-01-10'));
    await service.generate(userId, confirmedRule, new Date('2026-01-10'));

    const draftRow = await prisma.transaction.findFirstOrThrow({ where: { recurrenceRuleId: draftRule.id } });
    const confirmedRow = await prisma.transaction.findFirstOrThrow({ where: { recurrenceRuleId: confirmedRule.id } });

    expect(draftRow.status).toBe('DRAFT');
    expect(confirmedRow.status).toBe('CONFIRMED');
  });

  it('excludes DRAFT recurring entries from account balances (ADR-0012)', async () => {
    const rule = await createRule({ autoConfirm: false });
    await service.generate(userId, rule, new Date('2026-01-10'));

    const balance = await prisma.transaction.aggregate({
      where: { userId, accountId, status: 'CONFIRMED' },
      _sum: { amount: true },
    });

    expect(balance._sum.amount).toBeNull();
  });

  it('rejects a rule whose type is not INCOME/EXPENSE', async () => {
    const rule = await createRule({ type: 'TRANSFER' });

    await expect(service.generate(userId, rule, new Date('2026-01-10'))).rejects.toMatchObject({ status: 400 });
    await expect(prisma.transaction.count({ where: { recurrenceRuleId: rule.id } })).resolves.toBe(0);
  });

  it('rolls back cleanly when the transaction fails after createMany: no rows written, generatedUntil unchanged', async () => {
    const rule = await createRule();

    type InteractiveTransaction = (
      fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: Parameters<typeof prisma.$transaction>[1],
    ) => Promise<unknown>;

    const realTransaction = prisma.$transaction.bind(prisma) as InteractiveTransaction;
    const spy = jest
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (fn: Parameters<InteractiveTransaction>[0], options: Parameters<InteractiveTransaction>[1]) =>
        realTransaction(async (tx) => {
          jest.spyOn(tx.recurrenceRule, 'update').mockRejectedValueOnce(new Error('forced failure'));
          return fn(tx);
        }, options),
      );

    await expect(service.generate(userId, rule, new Date('2026-03-10'))).rejects.toThrow('forced failure');

    spy.mockRestore();

    await expect(prisma.transaction.count({ where: { recurrenceRuleId: rule.id } })).resolves.toBe(0);
    const reloaded = await prisma.recurrenceRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(reloaded.generatedUntil).toBeNull();
  });
});

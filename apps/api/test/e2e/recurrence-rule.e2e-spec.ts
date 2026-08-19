import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validate } from '../../src/config/env.validation';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for the `RecurrenceRule` model and its migration (M7-T01). Requires a
 * database with the migrations applied, since every assertion here is a real round-trip — the
 * point of this ticket is constraints the database enforces, not TypeScript types.
 *
 * Same minimal graph as the `Transaction` suite: `ConfigModule` + `PrismaModule`, no HTTP layer —
 * the module/service/controller/DTOs arrive in M7-T02/T03.
 */
describe('RecurrenceRule model (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let userId: string;
  let accountId: string;
  let categoryId: string;

  const email = 'recurrence-rule.e2e@family-budget.test';

  // Transactions/rules hold foreign keys onto everything else, so they come off first.
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
    }).compile();

    prisma = moduleRef.get(PrismaService);

    await moduleRef.init();
  });

  // The database is shared with local development, so the fixtures are removed on both sides of
  // the suite: a run interrupted halfway never breaks the next one.
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

  // A function, not a constant: it closes over userId etc, which only get their real value once
  // beforeEach has run — evaluating it at describe-time would read them before assignment.
  const minimal = () => ({
    userId,
    type: 'EXPENSE' as const,
    amount: 5_000,
    description: 'Seguro de casa',
    frequency: 'MONTHLY' as const,
    dayOfMonth: 10,
    startDate: new Date('2026-01-10'),
  });

  it('creates an open-ended rule (totalOccurrences: null) and asserts the defaults', async () => {
    const created = await prisma.recurrenceRule.create({ data: minimal() });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created).toMatchObject({ totalOccurrences: null, interval: 1, autoConfirm: true, isActive: true, generatedUntil: null });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    await expect(prisma.recurrenceRule.findUnique({ where: { id: created.id } })).resolves.toEqual(created);
  });

  it('creates an installment rule (totalOccurrences: 12)', async () => {
    const created = await prisma.recurrenceRule.create({ data: { ...minimal(), totalOccurrences: 12 } });

    expect(created.totalOccurrences).toBe(12);
  });

  it('deleting a rule keeps its transactions, with recurrenceRuleId nulled', async () => {
    const rule = await prisma.recurrenceRule.create({ data: minimal() });
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'EXPENSE',
        amount: 5_000,
        date: new Date('2026-01-10'),
        referenceMonth: new Date('2026-01-01'),
        description: 'Seguro de casa',
        accountId,
        categoryId,
        recurrenceRuleId: rule.id,
        installmentNumber: 1,
        installmentTotal: 12,
      },
    });

    await prisma.recurrenceRule.delete({ where: { id: rule.id } });

    const after = await prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id } });
    expect(after).toMatchObject({ recurrenceRuleId: null, installmentNumber: 1, installmentTotal: 12 });
  });

  it('refuses to delete an Account or Category referenced by a rule', async () => {
    await prisma.recurrenceRule.create({ data: { ...minimal(), accountId, categoryId } });

    await expect(prisma.account.delete({ where: { id: accountId } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.category.delete({ where: { id: categoryId } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects a duplicate (recurrenceRuleId, referenceMonth) but accepts two null-rule transactions in the same month', async () => {
    const rule = await prisma.recurrenceRule.create({ data: minimal() });
    const transactionData = (overrides: object) => ({
      userId,
      type: 'EXPENSE' as const,
      amount: 5_000,
      date: new Date('2026-01-10'),
      referenceMonth: new Date('2026-01-01'),
      description: 'Seguro de casa',
      accountId,
      categoryId,
      ...overrides,
    });

    await prisma.transaction.create({ data: transactionData({ recurrenceRuleId: rule.id }) });

    await expect(prisma.transaction.create({ data: transactionData({ recurrenceRuleId: rule.id }) })).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      Promise.all([prisma.transaction.create({ data: transactionData({}) }), prisma.transaction.create({ data: transactionData({}) })]),
    ).resolves.toHaveLength(2);
  });

  it('rejects a zero or negative amount', async () => {
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), amount: 0 } })).rejects.toMatchObject({ code: 'P2039' });
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), amount: -1 } })).rejects.toMatchObject({ code: 'P2039' });
  });

  it('rejects a dayOfMonth outside 1-31', async () => {
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), dayOfMonth: 0 } })).rejects.toMatchObject({ code: 'P2039' });
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), dayOfMonth: 32 } })).rejects.toMatchObject({ code: 'P2039' });
  });

  it('rejects a zero or negative interval', async () => {
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), interval: 0 } })).rejects.toMatchObject({ code: 'P2039' });
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), interval: -1 } })).rejects.toMatchObject({ code: 'P2039' });
  });

  it('rejects totalOccurrences = 0', async () => {
    await expect(prisma.recurrenceRule.create({ data: { ...minimal(), totalOccurrences: 0 } })).rejects.toMatchObject({ code: 'P2039' });
  });
});

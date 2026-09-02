import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * The four hand-written CHECK constraints ADR-0020 adds — `recurrence_rule_amount_positive`,
 * `recurrence_rule_amount_required_when_auto_confirm`, `transaction_amount_positive` and
 * `transaction_amount_required_when_confirmed` — are not reachable through `RecurrenceRulesService`
 * or `TransactionsService`, both of which already reject the same rows before ever writing. This
 * suite goes around both services, straight at Prisma, to prove the database itself is still a
 * backstop (e.g. against `RecurrenceGeneratorService.toTransactionData`, which writes with
 * `skipDuplicates` and no service-level amount check of its own).
 */
describe('Amountless recurrence CHECK constraints (e2e)', () => {
  let prisma: PrismaService;
  let userId: string;

  const email = 'amountless-recurrence.e2e@family-budget.test';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: 'Amountless Recurrence E2E', passwordHash: 'unused' },
      update: {},
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.recurrenceRule.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it('recurrence_rule_amount_positive rejects a zero or negative amount, but allows null', async () => {
    await expect(
      prisma.recurrenceRule.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount: 0,
          description: 'Bad',
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: new Date('2026-01-01'),
          autoConfirm: false,
        },
      }),
    ).rejects.toThrow();

    const created = await prisma.recurrenceRule.create({
      data: {
        userId,
        type: 'EXPENSE',
        amount: null,
        description: 'Good',
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        startDate: new Date('2026-01-01'),
        autoConfirm: false,
      },
    });
    expect(created.amount).toBeNull();
  });

  it('recurrence_rule_amount_required_when_auto_confirm rejects a null amount when autoConfirm is true', async () => {
    await expect(
      prisma.recurrenceRule.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount: null,
          description: 'Bad',
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: new Date('2026-01-01'),
          autoConfirm: true,
        },
      }),
    ).rejects.toThrow();
  });

  it('transaction_amount_positive rejects a zero or negative amount, but allows null', async () => {
    await expect(
      prisma.transaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          status: 'DRAFT',
          amount: 0,
          date: new Date('2026-01-01'),
          settlementDate: new Date('2026-01-01'),
          referenceMonth: new Date('2026-01-01'),
          description: 'Bad',
        },
      }),
    ).rejects.toThrow();

    const created = await prisma.transaction.create({
      data: {
        userId,
        type: 'EXPENSE',
        status: 'DRAFT',
        amount: null,
        date: new Date('2026-01-01'),
        settlementDate: new Date('2026-01-01'),
        referenceMonth: new Date('2026-01-01'),
        description: 'Good',
      },
    });
    expect(created.amount).toBeNull();
  });

  it('transaction_amount_required_when_confirmed rejects a null amount on a CONFIRMED row', async () => {
    await expect(
      prisma.transaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          status: 'CONFIRMED',
          amount: null,
          date: new Date('2026-01-01'),
          settlementDate: new Date('2026-01-01'),
          referenceMonth: new Date('2026-01-01'),
          description: 'Bad',
        },
      }),
    ).rejects.toThrow();
  });
});

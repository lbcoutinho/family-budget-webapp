import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type CancelInstallmentPlanResultDto } from '../../src/modules/recurrence/dto/cancel-installment-plan-result.dto';
import { type InstallmentPlanDto } from '../../src/modules/recurrence/dto/installment-plan.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Installment plan creation and cancellation over the real request pipeline and a real database
 * (M7-T04). Requires the migrations to have been applied (`docker compose up -d postgres` then
 * `pnpm --filter api db:migrate`).
 *
 * Two accounts sign in, same as `recurrence-rules.e2e-spec.ts` (M7-T03) — cancelling another user's
 * plan must 404, not confirm the id exists.
 */
describe('Installments API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;
  let userId: string;
  let accountId: string;
  let categoryId: string;
  let subcategoryId: string;

  const password = 'correct horse battery staple';
  const emails = ['installments.api.e2e@family-budget.test', 'installments.api.e2e.other@family-budget.test'];

  const authed = (method: 'get' | 'post', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const validBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    totalAmount: 10_000,
    installments: 10,
    firstPaymentDate: '2026-01-15',
    purchaseDate: '2026-01-01',
    description: 'New sofa',
    accountId,
    categoryId,
    subcategoryId,
    ...overrides,
  });

  const createPlan = async (body: Record<string, unknown>, as = token): Promise<InstallmentPlanDto> =>
    (await authed('post', '/recurrence-rules/installment', as).send(body).expect(201)).body as InstallmentPlanDto;

  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.recurrenceRule.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.category.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.account.deleteMany({ where: { user: { email: { in: emails } } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    const passwordHash = await app.get(HashService).hash(password);

    for (const email of emails) {
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Installments E2E', passwordHash }, update: { passwordHash } });
    }

    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );

    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: emails[0]! }, select: { id: true } })).id;
  });

  beforeEach(async () => {
    await removeFixtures();

    const [account, category] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Conta', initialBalance: 0 }, select: { id: true } }),
      prisma.category.create({ data: { userId, name: 'Casa', kind: 'EXPENSE' }, select: { id: true } }),
    ]);
    accountId = account.id;
    categoryId = category.id;
    subcategoryId = (await prisma.category.create({ data: { userId, name: 'Móveis', kind: 'EXPENSE', parentId: categoryId }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('refuses the route without a token', async () => {
    await request(server).post('/api/recurrence-rules/installment').send(validBody()).expect(401);
  });

  describe('create', () => {
    it('creates one rule plus 10 installments on 10 consecutive reference months, summing exactly to totalAmount', async () => {
      const plan = await createPlan(validBody());

      expect(plan.installments).toHaveLength(10);
      expect(plan.installments.reduce((sum, i) => sum + i.amount, 0)).toBe(10_000);

      const referenceMonths = plan.installments.map((i) => i.referenceMonth);
      expect(referenceMonths).toEqual([
        '2026-01-01',
        '2026-02-01',
        '2026-03-01',
        '2026-04-01',
        '2026-05-01',
        '2026-06-01',
        '2026-07-01',
        '2026-08-01',
        '2026-09-01',
        '2026-10-01',
      ]);

      expect(plan.installments.map((i) => i.description)).toEqual(Array.from({ length: 10 }, (_, i) => `New sofa (${i + 1}/10)`));
      expect(plan.installments.every((i) => i.installmentNumber !== undefined)).toBe(true);
      expect(plan.installments.map((i) => i.installmentNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(plan.installments.every((i) => i.installmentTotal === 10)).toBe(true);
      expect(plan.installments.every((i) => i.notes === 'Purchased on 2026-01-01')).toBe(true);
      expect(plan.installments.every((i) => i.source === 'RECURRING')).toBe(true);
      expect(plan.installments.every((i) => i.recurrenceRuleId === plan.rule.id)).toBe(true);
      expect(plan.rule.generatedUntil).toBe(plan.installments.at(-1)!.date);
    });

    it('splits €100.00 in 3 installments as 3333 / 3333 / 3334', async () => {
      const plan = await createPlan(validBody({ totalAmount: 10_000, installments: 3 }));

      expect(plan.installments.map((i) => i.amount)).toEqual([3_333, 3_333, 3_334]);
    });

    it('bills the 28th (29th in a leap year) in February for a plan starting on the 31st', async () => {
      const plan = await createPlan(validBody({ firstPaymentDate: '2027-01-31', installments: 2 }));
      expect(plan.installments.map((i) => i.date)).toEqual(['2027-01-31', '2027-02-28']);

      const leapYearPlan = await createPlan(validBody({ firstPaymentDate: '2028-01-31', installments: 2 }));
      expect(leapYearPlan.installments.map((i) => i.date)).toEqual(['2028-01-31', '2028-02-29']);
    });

    it('produces DRAFT installments when autoConfirm is false, and they are excluded from balances', async () => {
      const balanceOf = async (): Promise<number> => {
        const balances = (await authed('get', '/accounts/balances').expect(200)).body as { accountId: string; balance: number }[];
        return balances.find((b) => b.accountId === accountId)!.balance;
      };

      const before = await balanceOf();

      const plan = await createPlan(validBody({ autoConfirm: false }));
      expect(plan.installments.every((i) => i.status === 'DRAFT')).toBe(true);

      expect(await balanceOf()).toBe(before);
    });

    it('leaves no rule and no transaction when a request fails', async () => {
      // A DTO/reference-validation failure — the only failure this black-box HTTP test can force
      // deterministically. `InstallmentsService.createPlan` runs `TransactionValidator.validate` and
      // `splitInstallments` before ever opening `prisma.$transaction`, so this never touches the
      // database; a genuine mid-`$transaction` rollback is covered at the unit level instead
      // (`installments.service.spec.ts`: "validates references before writing anything" asserts
      // `prisma.$transaction` is never called).
      await authed('post', '/recurrence-rules/installment')
        .send(validBody({ categoryId: undefined, subcategoryId: undefined, type: 'TRANSFER' }))
        .expect(400);

      const rules = await prisma.recurrenceRule.count({ where: { userId } });
      const transactions = await prisma.transaction.count({ where: { userId } });
      expect(rules).toBe(0);
      expect(transactions).toBe(0);
    });

    it('rejects totalAmount < installments with 400', async () => {
      await authed('post', '/recurrence-rules/installment')
        .send(validBody({ totalAmount: 2, installments: 10 }))
        .expect(400);
    });

    it('rejects installments < 2 with 400', async () => {
      await authed('post', '/recurrence-rules/installment')
        .send(validBody({ installments: 1 }))
        .expect(400);
    });

    it('rejects an inactive category with 400', async () => {
      const inactiveCategory = await prisma.category.create({ data: { userId, name: 'Retired', kind: 'EXPENSE', isActive: false }, select: { id: true } });

      await authed('post', '/recurrence-rules/installment')
        .send(validBody({ categoryId: inactiveCategory.id, subcategoryId: undefined }))
        .expect(400);
    });

    it('rejects type = TRANSFER with 400', async () => {
      await authed('post', '/recurrence-rules/installment')
        .send(validBody({ type: 'TRANSFER', categoryId: undefined, subcategoryId: undefined }))
        .expect(400);
    });
  });

  describe('cancel', () => {
    it('deletes only future, non-CONFIRMED installments; confirmed and past rows survive, and the rule deactivates', async () => {
      // Anchored to today so every installment lands in the future, regardless of when the suite runs.
      const firstPaymentDate = new Date();
      firstPaymentDate.setUTCDate(1);
      firstPaymentDate.setUTCMonth(firstPaymentDate.getUTCMonth() + 1);

      const plan = await createPlan(validBody({ firstPaymentDate: firstPaymentDate.toISOString().slice(0, 10), installments: 10, autoConfirm: false }));

      await prisma.transaction.updateMany({
        where: { id: { in: [plan.installments[0]!.id, plan.installments[1]!.id] } },
        data: { status: 'CONFIRMED' },
      });

      const result = (await authed('post', `/recurrence-rules/${plan.rule.id}/cancel-installments`).expect(200)).body as CancelInstallmentPlanResultDto;
      expect(result.deleted).toBe(8);

      const remaining = await prisma.transaction.findMany({ where: { recurrenceRuleId: plan.rule.id }, orderBy: { installmentNumber: 'asc' } });
      expect(remaining).toHaveLength(2);
      expect(remaining.every((r) => r.status === 'CONFIRMED')).toBe(true);

      const rule = await prisma.recurrenceRule.findUniqueOrThrow({ where: { id: plan.rule.id } });
      expect(rule.isActive).toBe(false);
    });

    it('400s cancelling an open-ended rule', async () => {
      const openEnded = (
        await authed('post', '/recurrence-rules')
          .send({
            type: 'EXPENSE',
            amount: 1_000,
            description: 'Rent',
            accountId,
            categoryId,
            subcategoryId,
            frequency: 'MONTHLY',
            dayOfMonth: 15,
            startDate: '2026-01-15',
          })
          .expect(201)
      ).body as { id: string };

      await authed('post', `/recurrence-rules/${openEnded.id}/cancel-installments`).expect(400);
    });

    it("404s cancelling another user's plan, or an unknown id", async () => {
      const plan = await createPlan(validBody());

      await authed('post', `/recurrence-rules/${plan.rule.id}/cancel-installments`, otherToken).expect(404);
      await authed('post', '/recurrence-rules/00000000-0000-0000-0000-000000000000/cancel-installments').expect(404);
    });
  });
});

import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CategoryKind } from '../../src/generated/prisma/client';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Budgets API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;

  const password = 'correct horse battery staple';
  const emails = ['budgets.api.e2e@family-budget.test', 'budgets.api.e2e.other@family-budget.test'];
  const authed = (method: 'get' | 'put' | 'patch' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);
  const userId = async (email = emails[0]!): Promise<string> => (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  const createCategory = async (overrides: { userId?: string; kind?: CategoryKind; parentId?: string | null; isActive?: boolean } = {}) =>
    prisma.category.create({
      data: {
        userId: overrides.userId ?? (await userId()),
        name: crypto.randomUUID(),
        kind: overrides.kind ?? CategoryKind.EXPENSE,
        parentId: overrides.parentId ?? null,
        isActive: overrides.isActive ?? true,
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHash = await app.get(HashService).hash(password);
    for (const email of emails) {
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Budgets E2E', passwordHash }, update: { passwordHash } });
    }
    const sessions = await Promise.all(
      emails.map(async (email) => ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken),
    );
    token = sessions[0]!;
    otherToken = sessions[1]!;
  });

  beforeEach(async () => {
    await prisma.budget.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.category.deleteMany({ where: { user: { email: { in: emails } } } });
  });

  afterAll(async () => {
    await prisma.budget.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.category.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('requires authentication and does not persist an absent quarter', async () => {
    await request(server).get('/api/budgets/2026/3').expect(401);
    await authed('get', '/budgets/2026/3').expect(204);
    expect(await prisma.budget.count({ where: { user: { email: { in: emails } } } })).toBe(0);
  });

  it('creates, reads, and atomically replaces the one Budget for a quarter', async () => {
    const food = await createCategory();
    const leisure = await createCategory();
    await authed('put', '/budgets/2026/3')
      .send({
        estimatedQuarterlyIncome: 1_050_000,
        note: 'First plan',
        allocations: [{ categoryId: food.id, targetPercentage: 25, adjustedMonthlyAmount: 87_500 }],
      })
      .expect(200);
    await authed('put', '/budgets/2026/3')
      .send({
        estimatedQuarterlyIncome: 1_100_000,
        note: null,
        allocations: [{ categoryId: leisure.id, targetPercentage: 30, adjustedMonthlyAmount: 110_000 }],
      })
      .expect(200);

    await expect(authed('get', '/budgets/2026/3').expect(200)).resolves.toMatchObject({
      body: {
        year: 2026,
        quarter: 3,
        estimatedQuarterlyIncome: 1_100_000,
        note: null,
        allocations: [{ categoryId: leisure.id, targetPercentage: 30, adjustedMonthlyAmount: 110_000 }],
      },
    });
    expect(await prisma.budget.count({ where: { user: { email: { in: emails } } } })).toBe(1);
    expect(await prisma.budgetAllocation.count({ where: { budget: { user: { email: { in: emails } } } } })).toBe(1);
  });

  it('validates allocatable Categories and omits zero allocations without notes', async () => {
    const expense = await createCategory();
    const income = await createCategory({ kind: CategoryKind.INCOME });
    const inactive = await createCategory({ isActive: false });
    const child = await createCategory({ parentId: expense.id });
    const other = await createCategory({ userId: await userId(emails[1]) });

    for (const categoryId of [income.id, inactive.id, child.id, other.id]) {
      await authed('put', '/budgets/2026/3')
        .send({ estimatedQuarterlyIncome: 100_000, allocations: [{ categoryId, targetPercentage: 10, adjustedMonthlyAmount: 1_000 }] })
        .expect(400);
    }
    await authed('put', '/budgets/2026/3')
      .send({ estimatedQuarterlyIncome: 100_000, allocations: [{ categoryId: expense.id, targetPercentage: 0, adjustedMonthlyAmount: 0 }] })
      .expect(200)
      .expect(({ body }: { body: unknown }) => expect((body as { allocations: unknown[] }).allocations).toEqual([]));
  });

  it('derives rounded values, allows over-allocation, and preserves an explicit zero percentage', async () => {
    const food = await createCategory();
    const rent = await createCategory();
    const response = await authed('put', '/budgets/2026/3')
      .send({
        estimatedQuarterlyIncome: 100_001,
        allocations: [
          { categoryId: food.id, targetPercentage: 33.33, adjustedMonthlyAmount: 11_111, note: 'Rounded manually' },
          { categoryId: rent.id, targetPercentage: 0, adjustedMonthlyAmount: 30_000 },
        ],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      effectiveQuarterlyExpenseTotal: 123_333,
      plannedFinancialGoalsAvailability: -23_332,
    });
    const body = response.body as { allocations: unknown[] };
    expect(body.allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: food.id,
          targetPercentage: 33.33,
          suggestedQuarterlyTarget: 33_330,
          suggestedMonthlyTarget: 11_110,
          adjustedMonthlyAmount: 11_111,
          effectiveQuarterlyTarget: 33_333,
          effectivePercentage: 33.33,
          note: 'Rounded manually',
        }),
        expect.objectContaining({ categoryId: rent.id, targetPercentage: 0, adjustedMonthlyAmount: 30_000, effectiveQuarterlyTarget: 90_000 }),
      ]),
    );
  });

  it('rejects duplicate, malformed, and more precise allocation inputs', async () => {
    const category = await createCategory();
    const allocation = { categoryId: category.id, targetPercentage: 10, adjustedMonthlyAmount: 1_000 };
    for (const allocations of [[allocation, allocation], [{ ...allocation, targetPercentage: 10.001 }], [{ ...allocation, adjustedMonthlyAmount: -1 }]]) {
      await authed('put', '/budgets/2026/3').send({ estimatedQuarterlyIncome: 100_000, allocations }).expect(400);
    }
  });

  it('preserves an allocated Category through rename and deactivation, but blocks deletion', async () => {
    const category = await createCategory();
    await authed('put', '/budgets/2026/3')
      .send({ estimatedQuarterlyIncome: 100_000, allocations: [{ categoryId: category.id, targetPercentage: 10, adjustedMonthlyAmount: 1_000 }] })
      .expect(200);

    await authed('patch', `/categories/${category.id}`).send({ name: 'Renamed' }).expect(200);
    const renamed = (await authed('get', '/budgets/2026/3').expect(200)).body as unknown as {
      allocations: { categoryId: string; category: { name: string } }[];
    };
    expect(renamed.allocations[0]).toMatchObject({ categoryId: category.id, category: { name: 'Renamed' } });

    await authed('patch', `/categories/${category.id}/deactivate`).expect(200);
    const saved = (
      await authed('put', '/budgets/2026/3')
        .send({ estimatedQuarterlyIncome: 100_000, allocations: [{ categoryId: category.id, targetPercentage: 10, adjustedMonthlyAmount: 1_000 }] })
        .expect(200)
    ).body as unknown as { allocations: { category: { isActive: boolean }; effectiveQuarterlyTarget: number }[] };
    expect(saved.allocations[0]).toMatchObject({ category: { isActive: false }, effectiveQuarterlyTarget: 3_000 });

    await authed('delete', `/categories/${category.id}`).expect(409).expect({
      statusCode: 409,
      code: 'RECORD_IN_USE',
      message: 'Other records still reference this one. Deactivate it instead of deleting it.',
    });
    await authed('put', '/budgets/2026/3', otherToken)
      .send({ estimatedQuarterlyIncome: 100_000, allocations: [{ categoryId: category.id, targetPercentage: 10, adjustedMonthlyAmount: 1_000 }] })
      .expect(400);
  });

  it('isolates the same period by owner', async () => {
    await authed('put', '/budgets/2026/3').send({ estimatedQuarterlyIncome: 100_000 }).expect(200);
    await authed('put', '/budgets/2026/3', otherToken).send({ estimatedQuarterlyIncome: 200_000 }).expect(200);

    await expect(authed('get', '/budgets/2026/3').expect(200)).resolves.toMatchObject({ body: { estimatedQuarterlyIncome: 100_000 } });
    await expect(authed('get', '/budgets/2026/3', otherToken).expect(200)).resolves.toMatchObject({ body: { estimatedQuarterlyIncome: 200_000 } });
    expect(await prisma.budget.count({ where: { user: { email: { in: emails } } } })).toBe(2);
  });

  it.each([
    ['/budgets/2026/0', { estimatedQuarterlyIncome: 100_000 }],
    ['/budgets/2026/5', { estimatedQuarterlyIncome: 100_000 }],
    ['/budgets/1999/1', { estimatedQuarterlyIncome: 100_000 }],
    ['/budgets/2026/1', { estimatedQuarterlyIncome: 0 }],
    ['/budgets/2026/1', { estimatedQuarterlyIncome: 1.5 }],
    ['/budgets/2026/1', { estimatedQuarterlyIncome: 100_000, userId: 'someone-else' }],
  ])('rejects invalid period or body for %s', async (path, body) => {
    await authed('put', path).send(body).expect(400);
  });
});

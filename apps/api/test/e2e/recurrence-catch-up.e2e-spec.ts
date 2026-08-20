import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type RecurrenceCatchUpResultDto } from '../../src/modules/recurrence/dto/recurrence-catch-up-result.dto';
import { ROLLING_HORIZON_MONTHS } from '../../src/modules/recurrence/horizon';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * `POST /recurrence-rules/catch-up` over the real request pipeline and a real database (#199).
 * Complements `recurrence-generator.e2e-spec.ts` (M7-T02, the per-rule engine, no HTTP) and
 * `recurrence-rules.e2e-spec.ts` (M7-T03, per-rule `POST /:id/generate`) — this suite is the
 * whole-user orchestration on top of both. Idempotency itself is not re-tested here; it is
 * `RecurrenceGeneratorService`'s guarantee, only exercised again as regression coverage.
 */
describe('Recurrence catch-up (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;
  let userId: string;
  let otherUserId: string;
  let accountId: string;
  let categoryId: string;

  const password = 'correct horse battery staple';
  const emails = ['recurrence-catch-up.e2e@family-budget.test', 'recurrence-catch-up.e2e.other@family-budget.test'];

  const authed = (as = token): request.Test => request(server).post('/api/recurrence-rules/catch-up').set('Authorization', `Bearer ${as}`);

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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Recurrence Catch-Up E2E', passwordHash }, update: { passwordHash } });
    }

    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );

    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: emails[0]! }, select: { id: true } })).id;
    otherUserId = (await prisma.user.findUniqueOrThrow({ where: { email: emails[1]! }, select: { id: true } })).id;
  });

  beforeEach(async () => {
    await removeFixtures();

    const [account, category] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Conta', initialBalance: 0 }, select: { id: true } }),
      prisma.category.create({ data: { userId, name: 'Casa', kind: 'EXPENSE' }, select: { id: true } }),
    ]);
    accountId = account.id;
    categoryId = category.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  /** Rule active since the 1st of the current month, so its whole occurrence set falls inside the horizon. */
  const createRule = (owner: string, description = 'Rent') => {
    const now = new Date();
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    return prisma.recurrenceRule.create({
      data: {
        userId: owner,
        type: 'EXPENSE',
        amount: 1_000,
        description,
        accountId: owner === userId ? accountId : undefined,
        categoryId: owner === userId ? categoryId : undefined,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        startDate,
      },
      select: { id: true },
    });
  };

  it('rejects an unauthenticated call', async () => {
    await request(server).post('/api/recurrence-rules/catch-up').expect(401);
  });

  it('generates exactly the months inside the horizon and nothing beyond it', async () => {
    const rule = await createRule(userId);

    const result = (await authed().expect(200)).body as RecurrenceCatchUpResultDto;

    // Current month plus ROLLING_HORIZON_MONTHS ahead, one occurrence per month.
    expect(result).toMatchObject({ rulesProcessed: 1, created: ROLLING_HORIZON_MONTHS + 1, failed: [], skippedLocked: false });

    const generated = await prisma.transaction.findMany({ where: { recurrenceRuleId: rule.id }, orderBy: { date: 'asc' } });
    expect(generated).toHaveLength(ROLLING_HORIZON_MONTHS + 1);

    const now = new Date();
    const horizon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + ROLLING_HORIZON_MONTHS + 1, 0));
    for (const transaction of generated) {
      expect(transaction.date.getTime()).toBeLessThanOrEqual(horizon.getTime());
    }
  });

  it('a second run creates zero new rows', async () => {
    await createRule(userId);

    await authed().expect(200);
    const second = (await authed().expect(200)).body as RecurrenceCatchUpResultDto;

    expect(second.created).toBe(0);
  });

  it('is scoped to the caller — another user is not touched by this run', async () => {
    await createRule(userId);
    const otherRule = await createRule(otherUserId, 'Other user rent');

    const result = (await authed().expect(200)).body as RecurrenceCatchUpResultDto;

    expect(result.rulesProcessed).toBe(1);
    const otherGenerated = await prisma.transaction.count({ where: { recurrenceRuleId: otherRule.id } });
    expect(otherGenerated).toBe(0);

    // The other user's own run reaches their rule independently.
    const otherResult = (await authed(otherToken).expect(200)).body as RecurrenceCatchUpResultDto;
    expect(otherResult.rulesProcessed).toBe(1);
  });
});

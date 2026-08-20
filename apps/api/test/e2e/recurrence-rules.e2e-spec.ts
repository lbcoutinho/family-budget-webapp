import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type GenerateRecurrenceRuleResultDto } from '../../src/modules/recurrence/dto/generate-recurrence-rule-result.dto';
import { type PreviewRecurrenceRuleDto } from '../../src/modules/recurrence/dto/preview-recurrence-rule.dto';
import { type RecurrenceRuleDto } from '../../src/modules/recurrence/dto/recurrence-rule.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * CRUD, manual generation and preview over the real request pipeline and a real database (M7-T03).
 * Requires the migrations to have been applied (`docker compose up -d postgres` then `pnpm --filter
 * api db:migrate`).
 *
 * Two accounts sign in, because half of what this endpoint has to get right is that neither can see
 * the other's rules (ADR-0006). Distinct from `recurrence-rule.e2e-spec.ts` (M7-T01, model-only) and
 * `recurrence-generator.e2e-spec.ts` (M7-T02, service-only, no HTTP layer) — this suite is the
 * controller wired on top of both.
 */
describe('Recurrence rules API (e2e)', () => {
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
  const emails = ['recurrence-rules.api.e2e@family-budget.test', 'recurrence-rules.api.e2e.other@family-budget.test'];

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const createRule = async (body: Record<string, unknown>, as = token): Promise<RecurrenceRuleDto> =>
    (await authed('post', '/recurrence-rules', as).send(body).expect(201)).body as RecurrenceRuleDto;

  const validBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    type: 'EXPENSE',
    amount: 1_000,
    description: 'Rent',
    accountId,
    categoryId,
    subcategoryId,
    frequency: 'MONTHLY',
    dayOfMonth: 15,
    startDate: '2026-01-15',
    ...overrides,
  });

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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Recurrence Rules E2E', passwordHash }, update: { passwordHash } });
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
    subcategoryId = (await prisma.category.create({ data: { userId, name: 'Aluguel', kind: 'EXPENSE', parentId: categoryId }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('refuses every route without a token', async () => {
    await request(server).get('/api/recurrence-rules').expect(401);
    await request(server).post('/api/recurrence-rules').send(validBody()).expect(401);
  });

  describe('create', () => {
    it('creates a rule and hands back the defaults', async () => {
      const created = await createRule(validBody());

      expect(created).toMatchObject({
        type: 'EXPENSE',
        amount: 1_000,
        description: 'Rent',
        accountId,
        categoryId,
        frequency: 'MONTHLY',
        interval: 1,
        dayOfMonth: 15,
        startDate: '2026-01-15',
        endDate: null,
        totalOccurrences: null,
        autoConfirm: true,
        isActive: true,
        generatedUntil: null,
      });
      expect(created).not.toHaveProperty('userId');
    });

    it('rejects a dayOfMonth outside 1-31 with 400', async () => {
      await authed('post', '/recurrence-rules')
        .send(validBody({ dayOfMonth: 32 }))
        .expect(400);
      await authed('post', '/recurrence-rules')
        .send(validBody({ dayOfMonth: 0 }))
        .expect(400);
    });

    it('rejects an endDate at or before startDate with 400', async () => {
      await authed('post', '/recurrence-rules')
        .send(validBody({ startDate: '2026-03-01', endDate: '2026-03-01' }))
        .expect(400);
      await authed('post', '/recurrence-rules')
        .send(validBody({ startDate: '2026-03-01', endDate: '2026-02-01' }))
        .expect(400);
    });

    it('rejects an inactive category with 400', async () => {
      const inactiveCategory = await prisma.category.create({ data: { userId, name: 'Retired', kind: 'EXPENSE', isActive: false }, select: { id: true } });

      await authed('post', '/recurrence-rules')
        .send(validBody({ categoryId: inactiveCategory.id }))
        .expect(400);
    });

    it('rejects an inactive account with 400', async () => {
      const inactiveAccount = await prisma.account.create({ data: { userId, name: 'Retired', initialBalance: 0, isActive: false }, select: { id: true } });

      await authed('post', '/recurrence-rules')
        .send(validBody({ accountId: inactiveAccount.id }))
        .expect(400);
    });

    it('rejects a foreign accountId with 404', async () => {
      const foreignAccount = await prisma.account.create({
        data: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: emails[1]! }, select: { id: true } })).id, name: 'Not mine', initialBalance: 0 },
        select: { id: true },
      });

      await authed('post', '/recurrence-rules')
        .send(validBody({ accountId: foreignAccount.id }))
        .expect(404);
    });
  });

  describe('read, update', () => {
    it('reads a rule back by id', async () => {
      const created = await createRule(validBody());

      await expect(authed('get', `/recurrence-rules/${created.id}`).expect(200)).resolves.toMatchObject({ body: { id: created.id, description: 'Rent' } });
    });

    it('applies a partial update', async () => {
      const created = await createRule(validBody());

      const updated = (await authed('patch', `/recurrence-rules/${created.id}`).send({ amount: 2_000 }).expect(200)).body as RecurrenceRuleDto;

      expect(updated.amount).toBe(2_000);
      expect(updated.description).toBe('Rent');
    });

    it('re-validates references when categoryId is patched to an inactive one', async () => {
      const created = await createRule(validBody());
      const inactiveCategory = await prisma.category.create({ data: { userId, name: 'Retired', kind: 'EXPENSE', isActive: false }, select: { id: true } });

      await authed('patch', `/recurrence-rules/${created.id}`).send({ categoryId: inactiveCategory.id }).expect(400);
    });

    it('another user reading or updating this rule gets 404', async () => {
      const created = await createRule(validBody());

      await authed('get', `/recurrence-rules/${created.id}`, otherToken).expect(404);
      await authed('patch', `/recurrence-rules/${created.id}`, otherToken).send({ amount: 5_000 }).expect(404);
    });
  });

  describe('delete', () => {
    it('deletes outright when nothing was generated yet', async () => {
      const created = await createRule(validBody());

      await authed('delete', `/recurrence-rules/${created.id}`).expect(200);
      await authed('get', `/recurrence-rules/${created.id}`).expect(404);
    });

    it('deactivates instead of deleting when generated transactions exist, and they survive', async () => {
      const created = await createRule(validBody());

      await prisma.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          subcategoryId,
          type: 'EXPENSE',
          amount: 1_000,
          description: 'Rent',
          date: new Date('2026-01-15'),
          referenceMonth: new Date('2026-01-01'),
          recurrenceRuleId: created.id,
        },
      });

      const deactivated = (await authed('delete', `/recurrence-rules/${created.id}`).expect(200)).body as RecurrenceRuleDto;
      expect(deactivated.isActive).toBe(false);

      const stillThere = await prisma.transaction.findMany({ where: { recurrenceRuleId: created.id } });
      expect(stillThere).toHaveLength(1);
    });
  });

  describe('generate', () => {
    it('creates transactions on first call, and a second call creates no duplicates', async () => {
      const created = await createRule(validBody());

      const first = (await authed('post', `/recurrence-rules/${created.id}/generate`).expect(201)).body as GenerateRecurrenceRuleResultDto;
      expect(first.created).toBeGreaterThan(0);

      const second = (await authed('post', `/recurrence-rules/${created.id}/generate`).expect(201)).body as GenerateRecurrenceRuleResultDto;
      expect(second.created).toBe(0);

      const total = await prisma.transaction.count({ where: { recurrenceRuleId: created.id } });
      expect(total).toBe(first.created);
    });

    it('another user cannot trigger generation on this rule', async () => {
      const created = await createRule(validBody());

      await authed('post', `/recurrence-rules/${created.id}/generate`, otherToken).expect(404);
    });
  });

  describe('preview', () => {
    it('returns upcoming occurrences without writing anything', async () => {
      const created = await createRule(validBody());

      const before = await prisma.transaction.count({ where: { recurrenceRuleId: created.id } });

      const preview = (await authed('get', `/recurrence-rules/${created.id}/preview?months=12`).expect(200)).body as PreviewRecurrenceRuleDto;
      expect(preview.occurrences.length).toBeGreaterThan(0);

      const after = await prisma.transaction.count({ where: { recurrenceRuleId: created.id } });
      expect(after).toBe(before);

      const rule = await prisma.recurrenceRule.findUniqueOrThrow({ where: { id: created.id } });
      expect(rule.generatedUntil).toBeNull();
    });
  });
});

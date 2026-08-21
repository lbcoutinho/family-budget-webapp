import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type TransactionDto } from '../../src/modules/transactions/dto/transaction.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Transaction CRUD over the real request pipeline and a real database (M4-T04, M4-T05, M4-T06):
 * `INCOME`/`EXPENSE`, `TRANSFER`, plus `CASHBOX_IN`/`CASHBOX_OUT`/`CASHBOX_TRANSFER`. Requires the
 * migrations to have been applied (`docker compose up -d postgres` then `pnpm --filter api db:migrate`).
 *
 * Two accounts sign in, following `cashboxes.e2e-spec.ts`'s isolation pattern: half of what these
 * routes have to get right is that neither user can see or touch the other's transactions.
 */
describe('Transactions API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;
  let accountId: string;
  let destinationAccountId: string;
  let inactiveAccountId: string;
  let categoryId: string;
  let subcategoryId: string;
  let incomeCategoryId: string;
  let incomeSubcategoryId: string;
  let inactiveCategoryId: string;
  let cashboxId: string;
  let destinationCashboxId: string;
  let inactiveCashboxId: string;

  const password = 'correct horse battery staple';
  const emails = ['transactions.api.e2e@family-budget.test', 'transactions.api.e2e.other@family-budget.test'];

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const minimalBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    type: 'EXPENSE',
    amount: 1_000,
    date: '2026-03-15',
    description: 'Coffee',
    accountId,
    categoryId,
    subcategoryId,
    ...overrides,
  });

  const createTransaction = async (body: Record<string, unknown>, as = token): Promise<TransactionDto> =>
    (await authed('post', '/transactions', as).send(body).expect(201)).body as TransactionDto;

  // Transactions hold foreign keys onto everything else, so they come off first.
  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email: { in: emails } } } });
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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Transactions E2E', passwordHash }, update: { passwordHash } });
    }

    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );

    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
  });

  // The database is shared with local development, so fixtures are rebuilt on both sides of the
  // suite: a run interrupted halfway never breaks the next one.
  beforeEach(async () => {
    await removeFixtures();
    await prisma.account.deleteMany({ where: { user: { email: emails[0] } } });
    await prisma.category.deleteMany({ where: { user: { email: emails[0] } } });
    await prisma.cashbox.deleteMany({ where: { user: { email: emails[0] } } });

    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, select: { id: true } });

    const [account, destinationAccount, inactiveAccount, category, incomeCategory, inactiveCategory, cashbox, destinationCashbox, inactiveCashbox] =
      await Promise.all([
        prisma.account.create({ data: { userId: user.id, name: 'Millennium' }, select: { id: true } }),
        prisma.account.create({ data: { userId: user.id, name: 'Poupança' }, select: { id: true } }),
        prisma.account.create({ data: { userId: user.id, name: 'Encerrada', isActive: false }, select: { id: true } }),
        prisma.category.create({ data: { userId: user.id, name: 'Alimentação', kind: 'EXPENSE' }, select: { id: true } }),
        prisma.category.create({ data: { userId: user.id, name: 'Salário', kind: 'INCOME' }, select: { id: true } }),
        prisma.category.create({ data: { userId: user.id, name: 'Retirado', kind: 'EXPENSE', isActive: false }, select: { id: true } }),
        prisma.cashbox.create({ data: { userId: user.id, name: 'Carro' }, select: { id: true } }),
        prisma.cashbox.create({ data: { userId: user.id, name: 'Férias' }, select: { id: true } }),
        prisma.cashbox.create({ data: { userId: user.id, name: 'Aposentado', isActive: false }, select: { id: true } }),
      ]);
    accountId = account.id;
    destinationAccountId = destinationAccount.id;
    inactiveAccountId = inactiveAccount.id;
    categoryId = category.id;
    incomeCategoryId = incomeCategory.id;
    inactiveCategoryId = inactiveCategory.id;
    cashboxId = cashbox.id;
    destinationCashboxId = destinationCashbox.id;
    inactiveCashboxId = inactiveCashbox.id;

    const [subcategory, incomeSubcategory] = await Promise.all([
      prisma.category.create({ data: { userId: user.id, parentId: categoryId, name: 'Restaurante', kind: 'EXPENSE' }, select: { id: true } }),
      prisma.category.create({ data: { userId: user.id, parentId: incomeCategoryId, name: 'Extra', kind: 'INCOME' }, select: { id: true } }),
    ]);
    incomeSubcategoryId = incomeSubcategory.id;
    subcategoryId = subcategory.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.account.deleteMany({ where: { user: { email: emails[0] } } });
    await prisma.category.deleteMany({ where: { user: { email: emails[0] } } });
    await prisma.cashbox.deleteMany({ where: { user: { email: emails[0] } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('refuses every route without a token', async () => {
    await request(server).post('/api/transactions').send(minimalBody()).expect(401);
  });

  describe('create', () => {
    it.each(['INCOME', 'EXPENSE'] as const)('creates a %s with status CONFIRMED and source MANUAL', async (type) => {
      const refs = type === 'INCOME' ? { categoryId: incomeCategoryId, subcategoryId: incomeSubcategoryId } : {};

      const created = await createTransaction(minimalBody({ type, ...refs }));

      expect(created).toMatchObject({ type, status: 'CONFIRMED', source: 'MANUAL', amount: 1_000, date: '2026-03-15', description: 'Coffee' });
      expect(created).not.toHaveProperty('userId');
    });

    it('derives referenceMonth from date when omitted', async () => {
      const created = await createTransaction(minimalBody({ date: '2026-03-15' }));

      expect(created.referenceMonth).toBe('2026-03-01');
    });

    it('normalizes a supplied referenceMonth to the 1st', async () => {
      const created = await createTransaction(minimalBody({ referenceMonth: '2026-04-20' }));

      expect(created.referenceMonth).toBe('2026-04-01');
    });

    it('rejects an unknown type with 400', async () => {
      await authed('post', '/transactions')
        .send(minimalBody({ type: 'BOGUS' }))
        .expect(400);
    });

    it('rejects a missing required reference field with 400 TRANSACTION_FIELD_REQUIRED', async () => {
      const { categoryId: _categoryId, ...body } = minimalBody();

      const response = await authed('post', '/transactions').send(body).expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_FIELD_REQUIRED' });
    });

    it('rejects a category whose kind does not match the type with 400 TRANSACTION_CATEGORY_KIND_MISMATCH', async () => {
      const response = await authed('post', '/transactions')
        .send(minimalBody({ categoryId: incomeCategoryId }))
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_CATEGORY_KIND_MISMATCH' });
    });

    it('rejects an inactive category with 400 TRANSACTION_REFERENCE_INACTIVE', async () => {
      const subcategoryOfInactive = await prisma.category.create({
        data: {
          userId: (await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).userId,
          parentId: inactiveCategoryId,
          name: 'Sub',
          kind: 'EXPENSE',
        },
      });

      const response = await authed('post', '/transactions')
        .send(minimalBody({ categoryId: inactiveCategoryId, subcategoryId: subcategoryOfInactive.id }))
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_REFERENCE_INACTIVE' });
    });

    it('answers 404 for a reference belonging to another user', async () => {
      await authed('post', '/transactions', otherToken).send(minimalBody()).expect(404);
    });

    it('returns null recurrence/installment metadata for a manual transaction', async () => {
      const created = await createTransaction(minimalBody());

      expect(created).toMatchObject({ recurrenceRuleId: null, installmentNumber: null, installmentTotal: null });
    });
  });

  describe('read, update and delete one', () => {
    it('reads a transaction back by id', async () => {
      const created = await createTransaction(minimalBody());

      await expect(authed('get', `/transactions/${created.id}`).expect(200)).resolves.toMatchObject({ body: { id: created.id, description: 'Coffee' } });
    });

    it('applies a partial update that touches no reference field', async () => {
      const created = await createTransaction(minimalBody());

      const updated = (await authed('patch', `/transactions/${created.id}`).send({ description: 'Renamed' }).expect(200)).body as TransactionDto;

      expect(updated).toMatchObject({ description: 'Renamed', accountId, categoryId, subcategoryId });
    });

    it('lets an edit touching no reference field succeed even once its category was retired (ADR-0015)', async () => {
      const created = await createTransaction(minimalBody());

      await authed('patch', `/categories/${categoryId}/deactivate`).expect(200);

      await expect(authed('patch', `/transactions/${created.id}`).send({ description: 'Still fine' }).expect(200)).resolves.toMatchObject({
        body: { description: 'Still fine' },
      });
    });

    it('re-validates and rejects an inactive reference when the patch touches it', async () => {
      const created = await createTransaction(minimalBody());

      await authed('patch', `/categories/${categoryId}/deactivate`).expect(200);

      const response = await authed('patch', `/transactions/${created.id}`).send({ categoryId }).expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_REFERENCE_INACTIVE' });
    });

    it('rejects an attempt to change type with 400 TRANSACTION_TYPE_IMMUTABLE', async () => {
      const created = await createTransaction(minimalBody({ type: 'EXPENSE' }));

      const response = await authed('patch', `/transactions/${created.id}`).send({ type: 'INCOME' }).expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_TYPE_IMMUTABLE' });
    });

    it('preserves referenceMonth on a credit-card date change and recomputes it otherwise (ADR-0009)', async () => {
      const creditCard = await createTransaction(minimalBody({ isCreditCard: true, date: '2026-03-15' }));
      const regular = await createTransaction(minimalBody({ isCreditCard: false, date: '2026-03-15' }));

      const updatedCreditCard = (await authed('patch', `/transactions/${creditCard.id}`).send({ date: '2026-04-10' }).expect(200)).body as TransactionDto;
      const updatedRegular = (await authed('patch', `/transactions/${regular.id}`).send({ date: '2026-04-10' }).expect(200)).body as TransactionDto;

      expect(updatedCreditCard.referenceMonth).toBe('2026-03-01');
      expect(updatedRegular.referenceMonth).toBe('2026-04-01');
    });

    it('deletes for good', async () => {
      const created = await createTransaction(minimalBody());

      await authed('delete', `/transactions/${created.id}`).expect(204);
      await authed('get', `/transactions/${created.id}`).expect(404);
    });

    it('rejects an id that is not a uuid with 400', async () => {
      await authed('get', '/transactions/not-a-uuid').expect(400);
    });

    it('answers 404 for an id that does not exist', async () => {
      await authed('get', '/transactions/6f9619ff-8b86-d011-b42d-00c04fc964ff').expect(404);
    });
  });

  // Every by-id route, proven one by one: 404 and not 403, because a 403 would confirm to the
  // other user that the id exists.
  describe("another user's transaction", () => {
    it.each([
      ['get', ''],
      ['delete', ''],
    ] as const)('answers 404 to %s %s', async (method, suffix) => {
      const created = await createTransaction(minimalBody());

      await authed(method, `/transactions/${created.id}${suffix}`, otherToken).expect(404);
    });

    it('answers 404 to a patch, and leaves the row untouched', async () => {
      const created = await createTransaction(minimalBody());

      await authed('patch', `/transactions/${created.id}`, otherToken).send({ description: 'Hijacked' }).expect(404);

      await expect(authed('get', `/transactions/${created.id}`).expect(200)).resolves.toMatchObject({ body: { description: 'Coffee' } });
    });
  });

  describe('account-to-account transfer (M4-T06)', () => {
    const transferBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
      minimalBody({ type: 'TRANSFER', accountId, destinationAccountId, categoryId: undefined, subcategoryId: undefined, ...overrides });

    it('creates a TRANSFER with both account ids and reads it back', async () => {
      const created = await createTransaction(transferBody());

      expect(created).toMatchObject({ type: 'TRANSFER', accountId, destinationAccountId });

      const reread = (await authed('get', `/transactions/${created.id}`).expect(200)).body as TransactionDto;
      expect(reread).toMatchObject({ accountId, destinationAccountId });
    });

    it.each(['categoryId', 'subcategoryId', 'cashboxId', 'destinationCashboxId'] as const)(
      'rejects %s on a TRANSFER with 400 TRANSACTION_FIELD_NOT_ALLOWED',
      async (field) => {
        const response = await authed('post', '/transactions')
          .send(transferBody({ [field]: field.toLowerCase().includes('cashbox') ? cashboxId : categoryId }))
          .expect(400);
        expect(response.body).toMatchObject({ code: 'TRANSACTION_FIELD_NOT_ALLOWED' });
      },
    );

    it.each(['accountId', 'destinationAccountId'] as const)('rejects a missing %s with 400 TRANSACTION_FIELD_REQUIRED', async (field) => {
      const response = await authed('post', '/transactions')
        .send(transferBody({ [field]: undefined }))
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_FIELD_REQUIRED' });
    });

    it('rejects destinationAccountId equal to accountId with 400 TRANSACTION_SAME_ACCOUNT', async () => {
      const response = await authed('post', '/transactions')
        .send(transferBody({ destinationAccountId: accountId }))
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_SAME_ACCOUNT' });
    });

    it('answers 404 when either account belongs to another user', async () => {
      await authed('post', '/transactions', otherToken).send(transferBody()).expect(404);
    });

    it('rejects an inactive account with 400 TRANSACTION_REFERENCE_INACTIVE', async () => {
      const response = await authed('post', '/transactions')
        .send(transferBody({ destinationAccountId: inactiveAccountId }))
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_REFERENCE_INACTIVE' });
    });

    it('accepts a transfer that would leave the source account negative — no balance check', async () => {
      const created = await createTransaction(transferBody({ amount: 1_000_000 }));
      expect(created.amount).toBe(1_000_000);
    });

    it('rejects an attempt to change type away from TRANSFER with 400 TRANSACTION_TYPE_IMMUTABLE', async () => {
      const created = await createTransaction(transferBody());

      const response = await authed('patch', `/transactions/${created.id}`).send({ type: 'EXPENSE' }).expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_TYPE_IMMUTABLE' });
    });

    it('re-validates and rejects when a patch points destinationAccountId at an inactive account', async () => {
      const created = await createTransaction(transferBody());

      const response = await authed('patch', `/transactions/${created.id}`).send({ destinationAccountId: inactiveAccountId }).expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_REFERENCE_INACTIVE' });
    });
  });

  describe('cashbox operations (M4-T05)', () => {
    it('deposits, withdraws and transfers between cashboxes', async () => {
      const deposit = await createTransaction(
        minimalBody({
          type: 'CASHBOX_IN',
          amount: 10_000,
          description: 'Save for the car',
          accountId,
          categoryId: undefined,
          subcategoryId: undefined,
          cashboxId,
        }),
      );
      expect(deposit).toMatchObject({ type: 'CASHBOX_IN', cashboxLabel: 'Carro' });

      const withdrawal = await createTransaction(
        minimalBody({
          type: 'CASHBOX_OUT',
          amount: 4_000,
          description: 'Bought the car',
          accountId,
          categoryId: undefined,
          subcategoryId: undefined,
          cashboxId,
        }),
      );
      expect(withdrawal).toMatchObject({ type: 'CASHBOX_OUT', cashboxLabel: 'Carro' });

      const transfer = await createTransaction(
        minimalBody({
          type: 'CASHBOX_TRANSFER',
          amount: 5_000,
          description: 'Move leftovers to vacations',
          accountId: undefined,
          categoryId: undefined,
          subcategoryId: undefined,
          cashboxId,
          destinationCashboxId,
        }),
      );
      expect(transfer).toMatchObject({ type: 'CASHBOX_TRANSFER', cashboxLabel: 'Carro', destinationCashboxLabel: 'Férias' });
    });

    it('rejects a withdrawal past the available balance with 409 CASHBOX_INSUFFICIENT_FUNDS, writing nothing', async () => {
      await createTransaction(
        minimalBody({ type: 'CASHBOX_IN', amount: 1_000, description: 'Fund it', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
      );

      const response = await authed('post', '/transactions')
        .send(
          minimalBody({ type: 'CASHBOX_OUT', amount: 2_000, description: 'Too much', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
        )
        .expect(409);
      expect(response.body).toMatchObject({ code: 'CASHBOX_INSUFFICIENT_FUNDS' });

      const list = await prisma.transaction.findMany({ where: { cashboxId }, select: { type: true } });
      expect(list).toEqual([{ type: 'CASHBOX_IN' }]);
    });

    it('rejects CASHBOX_TRANSFER with accountId set with 400', async () => {
      await authed('post', '/transactions')
        .send(
          minimalBody({
            type: 'CASHBOX_TRANSFER',
            description: 'Bad',
            categoryId: undefined,
            subcategoryId: undefined,
            cashboxId,
            destinationCashboxId,
          }),
        )
        .expect(400);
    });

    it('rejects the same cashbox on both sides of a transfer with 400 TRANSACTION_SAME_CASHBOX', async () => {
      const response = await authed('post', '/transactions')
        .send(
          minimalBody({
            type: 'CASHBOX_TRANSFER',
            description: 'Same pot',
            accountId: undefined,
            categoryId: undefined,
            subcategoryId: undefined,
            cashboxId,
            destinationCashboxId: cashboxId,
          }),
        )
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_SAME_CASHBOX' });
    });

    it('rejects an inactive cashbox with 400 TRANSACTION_REFERENCE_INACTIVE', async () => {
      const response = await authed('post', '/transactions')
        .send(
          minimalBody({
            type: 'CASHBOX_IN',
            description: 'Into a retired pot',
            accountId,
            categoryId: undefined,
            subcategoryId: undefined,
            cashboxId: inactiveCashboxId,
          }),
        )
        .expect(400);
      expect(response.body).toMatchObject({ code: 'TRANSACTION_REFERENCE_INACTIVE' });
    });

    it('keeps an old transaction label unchanged after the cashbox is renamed', async () => {
      const deposit = await createTransaction(
        minimalBody({ type: 'CASHBOX_IN', amount: 1_000, description: 'Save', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
      );

      await authed('patch', `/cashboxes/${cashboxId}`).send({ name: 'Renamed pot' }).expect(200);

      const reread = (await authed('get', `/transactions/${deposit.id}`).expect(200)).body as TransactionDto;
      expect(reread.cashboxLabel).toBe('Carro');
    });

    it('rejects raising a withdrawal past the available balance on update with 409 CASHBOX_INSUFFICIENT_FUNDS', async () => {
      await createTransaction(
        minimalBody({ type: 'CASHBOX_IN', amount: 5_000, description: 'Fund it', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
      );
      const withdrawal = await createTransaction(
        minimalBody({ type: 'CASHBOX_OUT', amount: 1_000, description: 'Withdraw', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
      );

      const response = await authed('patch', `/transactions/${withdrawal.id}`).send({ amount: 6_000 }).expect(409);
      expect(response.body).toMatchObject({ code: 'CASHBOX_INSUFFICIENT_FUNDS' });
    });

    it('rejects deleting a CASHBOX_IN that already funded a withdrawal, with 409 CASHBOX_INSUFFICIENT_FUNDS', async () => {
      const deposit = await createTransaction(
        minimalBody({ type: 'CASHBOX_IN', amount: 5_000, description: 'Fund it', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
      );
      await createTransaction(
        minimalBody({ type: 'CASHBOX_OUT', amount: 1_000, description: 'Withdraw', accountId, categoryId: undefined, subcategoryId: undefined, cashboxId }),
      );

      const response = await authed('delete', `/transactions/${deposit.id}`).expect(409);
      expect(response.body).toMatchObject({ code: 'CASHBOX_INSUFFICIENT_FUNDS' });
    });
  });

  describe('list (M4-T08)', () => {
    let coffeeId: string;
    let salaryId: string;
    let aprilId: string;
    let firstOfPairId: string;
    let secondOfPairId: string;
    let creditCardId: string;
    let deletedCashboxTxId: string;
    let draftId: string;

    beforeEach(async () => {
      coffeeId = (await createTransaction(minimalBody({ type: 'EXPENSE', amount: 1_000, date: '2026-03-15', description: 'Coffee' }))).id;

      salaryId = (
        await createTransaction(
          minimalBody({
            type: 'INCOME',
            amount: 5_000,
            date: '2026-03-10',
            description: 'Salary',
            categoryId: incomeCategoryId,
            subcategoryId: incomeSubcategoryId,
          }),
        )
      ).id;

      aprilId = (await createTransaction(minimalBody({ type: 'EXPENSE', amount: 2_000, date: '2026-04-01', description: 'Rent', notes: 'Apartment' }))).id;

      firstOfPairId = (await createTransaction(minimalBody({ type: 'EXPENSE', amount: 100, date: '2026-03-20', description: 'Same day A' }))).id;
      secondOfPairId = (await createTransaction(minimalBody({ type: 'EXPENSE', amount: 200, date: '2026-03-20', description: 'Same day B' }))).id;

      creditCardId = (await createTransaction(minimalBody({ type: 'EXPENSE', amount: 300, date: '2026-03-05', description: 'Card', isCreditCard: true }))).id;

      deletedCashboxTxId = (
        await createTransaction(
          minimalBody({
            type: 'CASHBOX_IN',
            amount: 4_000,
            date: '2026-03-12',
            description: 'Deposit',
            categoryId: undefined,
            subcategoryId: undefined,
            cashboxId,
          }),
        )
      ).id;
      // Bypasses `CashboxesService` entirely, same technique as `transaction.e2e-spec.ts`: the point
      // is the transaction row surviving with a null FK and its label snapshot intact (ADR-0019).
      await prisma.cashbox.delete({ where: { id: cashboxId } });

      const owner = (await prisma.account.findUniqueOrThrow({ where: { id: accountId } })).userId;
      draftId = (
        await prisma.transaction.create({
          data: {
            userId: owner,
            type: 'EXPENSE',
            status: 'DRAFT',
            amount: 500,
            date: new Date('2026-03-01'),
            referenceMonth: new Date('2026-03-01'),
            description: 'Voice draft',
            accountId,
            categoryId,
            subcategoryId,
          },
        })
      ).id;
    });

    it('unfiltered list hides the DRAFT; ?status=DRAFT shows only it', async () => {
      const unfiltered = (await authed('get', '/transactions').expect(200)).body as { items: { id: string }[] };
      expect(unfiltered.items.map((i) => i.id)).not.toContain(draftId);

      const draftsOnly = (await authed('get', '/transactions?status=DRAFT').expect(200)).body as { items: { id: string }[] };
      expect(draftsOnly.items.map((i) => i.id)).toEqual([draftId]);
    });

    it('narrows by a single filter, and composes two filters', async () => {
      const byType = (await authed('get', '/transactions?type=INCOME').expect(200)).body as { items: { id: string }[] };
      expect(byType.items.map((i) => i.id)).toEqual([salaryId]);

      const composed = (await authed('get', '/transactions?referenceMonth=2026-03-01&type=EXPENSE&isCreditCard=true').expect(200)).body as {
        items: { id: string }[];
      };
      expect(composed.items.map((i) => i.id)).toEqual([creditCardId]);
    });

    it('search is case-insensitive and matches description or notes', async () => {
      const byDescription = (await authed('get', '/transactions?search=COFFEE').expect(200)).body as { items: { id: string }[] };
      expect(byDescription.items.map((i) => i.id)).toEqual([coffeeId]);

      const byNotes = (await authed('get', '/transactions?search=apartment').expect(200)).body as { items: { id: string }[] };
      expect(byNotes.items.map((i) => i.id)).toEqual([aprilId]);
    });

    it('orders by date desc, falling back to createdAt desc on a same-date tie', async () => {
      const listed = (await authed('get', '/transactions?dateFrom=2026-03-20&dateTo=2026-03-20').expect(200)).body as { items: { id: string }[] };
      expect(listed.items.map((i) => i.id)).toEqual([secondOfPairId, firstOfPairId]);
    });

    it('walks the whole set via nextCursor with limit=2, with no duplicates, and terminates', async () => {
      const seen: string[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < 10; page += 1) {
        const response = (await authed('get', `/transactions?limit=2${cursor ? `&cursor=${cursor}` : ''}`).expect(200)).body as {
          items: { id: string }[];
          nextCursor: string | null;
        };
        seen.push(...response.items.map((i) => i.id));
        if (response.nextCursor === null) break;
        cursor = response.nextCursor;
      }

      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(expect.arrayContaining([coffeeId, salaryId, aprilId, firstOfPairId, secondOfPairId, creditCardId, deletedCashboxTxId]));
    });

    it('aggregates cover the whole filtered set and ignore limit', async () => {
      const body = (await authed('get', '/transactions?limit=1').expect(200)).body as { total: number; incomeTotal: number; expenseTotal: number };

      expect(body.total).toBe(7);
      expect(body.incomeTotal).toBe(5_000);
      expect(body.expenseTotal).toBe(1_000 + 2_000 + 100 + 200 + 300);
    });

    it('expands account/category/subcategory on the row, null where the FK is null', async () => {
      const body = (await authed('get', '/transactions').expect(200)).body as {
        items: {
          id: string;
          account: { id: string; name: string } | null;
          category: { id: string; name: string; color: string | null } | null;
          subcategory: { id: string; name: string; color: string | null } | null;
        }[];
      };

      const coffee = body.items.find((i) => i.id === coffeeId)!;
      expect(coffee.account).toMatchObject({ id: accountId, name: 'Millennium' });
      expect(coffee.category).toMatchObject({ id: categoryId, name: 'Alimentação' });
      expect(coffee.subcategory).toMatchObject({ id: subcategoryId, name: 'Restaurante' });

      const deposit = body.items.find((i) => i.id === deletedCashboxTxId)!;
      expect(deposit.category).toBeNull();
      expect(deposit.subcategory).toBeNull();
    });

    it('excludes a row whose cashbox was deleted from ?cashboxId=, while cashboxLabel is still present unfiltered', async () => {
      const filtered = (await authed('get', `/transactions?cashboxId=${cashboxId}`).expect(200)).body as { items: { id: string }[] };
      expect(filtered.items.map((i) => i.id)).not.toContain(deletedCashboxTxId);

      const unfiltered = (await authed('get', '/transactions').expect(200)).body as { items: { id: string; cashboxLabel: string | null }[] };
      const deposit = unfiltered.items.find((i) => i.id === deletedCashboxTxId)!;
      expect(deposit.cashboxLabel).toBe('Carro');
    });

    it("does not show another user's rows, and rejects limit=0 or limit=201 with 400", async () => {
      const otherList = (await authed('get', '/transactions', otherToken).expect(200)).body as { items: { id: string }[] };
      expect(otherList.items.map((i) => i.id)).not.toContain(coffeeId);

      await authed('get', '/transactions?limit=0').expect(400);
      await authed('get', '/transactions?limit=201').expect(400);
    });

    it('rejects an invalid sort value with 400', async () => {
      await authed('get', '/transactions?sort=bogus').expect(400);
    });

    it('omitting sort returns the same newest-first order as today', async () => {
      const explicit = (await authed('get', '/transactions?sort=newest').expect(200)).body as { items: { id: string }[] };
      const omitted = (await authed('get', '/transactions').expect(200)).body as { items: { id: string }[] };
      expect(omitted.items.map((i) => i.id)).toEqual(explicit.items.map((i) => i.id));
    });

    it.each(['newest', 'oldest', 'amountHighest', 'amountLowest', 'description'])('orders the whole filtered set by %s', async (sort) => {
      // Built inside the test body, not the `it.each` table, because the ids above are only assigned in `beforeEach`.
      const expectedBySort: Record<string, string[]> = {
        newest: [aprilId, secondOfPairId, firstOfPairId, coffeeId, deletedCashboxTxId, salaryId, creditCardId],
        oldest: [creditCardId, salaryId, deletedCashboxTxId, coffeeId, firstOfPairId, secondOfPairId, aprilId],
        amountHighest: [salaryId, deletedCashboxTxId, aprilId, coffeeId, creditCardId, secondOfPairId, firstOfPairId],
        amountLowest: [firstOfPairId, secondOfPairId, creditCardId, coffeeId, aprilId, deletedCashboxTxId, salaryId],
        description: [creditCardId, coffeeId, deletedCashboxTxId, aprilId, salaryId, firstOfPairId, secondOfPairId],
      };

      const body = (await authed('get', `/transactions?sort=${sort}`).expect(200)).body as { items: { id: string }[] };
      expect(body.items.map((i) => i.id)).toEqual(expectedBySort[sort]);
    });

    it('paginates disjoint, correctly-ordered pages under a non-default sort (amountHighest)', async () => {
      const seen: string[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < 10; page += 1) {
        const response = (await authed('get', `/transactions?sort=amountHighest&limit=2${cursor ? `&cursor=${cursor}` : ''}`).expect(200)).body as {
          items: { id: string }[];
          nextCursor: string | null;
        };
        seen.push(...response.items.map((i) => i.id));
        if (response.nextCursor === null) break;
        cursor = response.nextCursor;
      }

      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual([salaryId, deletedCashboxTxId, aprilId, coffeeId, creditCardId, secondOfPairId, firstOfPairId]);
    });
  });
});

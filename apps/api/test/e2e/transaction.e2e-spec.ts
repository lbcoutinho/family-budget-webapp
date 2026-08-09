import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validate } from '../../src/config/env.validation';
import { TransactionType } from '../../src/generated/prisma/client';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for the domain core model and its migration (M4-T01). Requires a database
 * with the migrations applied (`docker compose up -d postgres` then
 * `pnpm --filter api db:migrate`), since every assertion here is a real round-trip — the point of
 * this ticket is constraints the database enforces, not TypeScript types.
 *
 * Same minimal graph as the `Account` suite: `ConfigModule` + `PrismaModule`, no HTTP layer — the
 * endpoints and per-type validation arrive with M4-T02 onwards.
 */
describe('Transaction model (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let userId: string;
  let accountId: string;
  let categoryId: string;
  let subcategoryId: string;
  let cashboxId: string;

  const email = 'transaction.e2e@family-budget.test';

  // Transactions hold foreign keys onto everything else, so they come off first.
  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email } } });
    await prisma.cashbox.deleteMany({ where: { user: { email } } });
    await prisma.category.deleteMany({ where: { user: { email }, parentId: { not: null } } });
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

    const [account, category, cashbox] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Millennium' }, select: { id: true } }),
      prisma.category.create({ data: { userId, name: 'Alimentação', kind: 'EXPENSE' }, select: { id: true } }),
      prisma.cashbox.create({ data: { userId, name: 'Carro' }, select: { id: true } }),
    ]);
    accountId = account.id;
    categoryId = category.id;
    cashboxId = cashbox.id;

    const subcategory = await prisma.category.create({ data: { userId, parentId: categoryId, name: 'Restaurante', kind: 'EXPENSE' }, select: { id: true } });
    subcategoryId = subcategory.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await moduleRef.close();
  });

  // A function, not a constant: it closes over userId etc, which only get their real value once
  // beforeEach has run — evaluating it at describe-time would read them before assignment.
  const minimal = () => ({
    userId,
    type: TransactionType.EXPENSE,
    amount: 1_000,
    date: new Date('2026-03-15'),
    referenceMonth: new Date('2026-03-01'),
    description: 'Coffee',
  });

  it('creates a minimal transaction and asserts the defaults', async () => {
    const created = await prisma.transaction.create({ data: minimal() });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created).toMatchObject({ status: 'CONFIRMED', source: 'MANUAL', isCreditCard: false });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    await expect(prisma.transaction.findUnique({ where: { id: created.id } })).resolves.toEqual(created);
  });

  it.each(['INCOME', 'EXPENSE', 'TRANSFER', 'CASHBOX_IN', 'CASHBOX_OUT', 'CASHBOX_TRANSFER'] as const)(
    'creates a %s transaction with the relations it uses and reads it back',
    async (type) => {
      // Relations built here, not in the `it.each` array above: that array is evaluated at
      // describe-time, before beforeEach has assigned accountId/categoryId/cashboxId.
      const relationsByType: Record<TransactionType, object> = {
        INCOME: { accountId },
        EXPENSE: { accountId, categoryId, subcategoryId },
        TRANSFER: { accountId, destinationAccountId: accountId },
        CASHBOX_IN: { accountId, cashboxId, cashboxLabel: 'Carro' },
        CASHBOX_OUT: { accountId, cashboxId, cashboxLabel: 'Carro' },
        CASHBOX_TRANSFER: { cashboxId, destinationCashboxId: cashboxId, cashboxLabel: 'Carro', destinationCashboxLabel: 'Carro' },
      };

      const created = await prisma.transaction.create({ data: { ...minimal(), type, ...relationsByType[type] } });

      await expect(prisma.transaction.findUnique({ where: { id: created.id } })).resolves.toEqual(created);
    },
  );

  it('rejects a zero or negative amount', async () => {
    await expect(prisma.transaction.create({ data: { ...minimal(), amount: 0 } })).rejects.toMatchObject({ code: 'P2039' });
    await expect(prisma.transaction.create({ data: { ...minimal(), amount: -1 } })).rejects.toMatchObject({ code: 'P2039' });
  });

  it('rejects a referenceMonth that does not fall on the 1st', async () => {
    const create = prisma.transaction.create({ data: { ...minimal(), referenceMonth: new Date('2026-03-15') } });

    await expect(create).rejects.toMatchObject({ code: 'P2039' });
  });

  it('round-trips date and referenceMonth as plain dates regardless of client timezone', async () => {
    const created = await prisma.transaction.create({ data: { ...minimal(), date: new Date('2026-01-31'), referenceMonth: new Date('2026-01-01') } });

    const rows = await prisma.$queryRaw<{ date: Date; reference_month: Date; data_type_date: string; data_type_reference_month: string }[]>`
      SELECT date, reference_month,
        (SELECT data_type FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'date') AS data_type_date,
        (SELECT data_type FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'reference_month') AS data_type_reference_month
      FROM transactions WHERE id = ${created.id}::uuid
    `;

    expect(rows[0]?.data_type_date).toBe('date');
    expect(rows[0]?.data_type_reference_month).toBe('date');
    expect(rows[0]?.date.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(rows[0]?.reference_month.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('refuses to delete a User, Account or Category referenced by a transaction', async () => {
    await prisma.transaction.create({ data: { ...minimal(), accountId, categoryId } });

    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.account.delete({ where: { id: accountId } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.category.delete({ where: { id: categoryId } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('nulls cashboxId/destinationCashboxId on delete while preserving the label snapshots', async () => {
    const created = await prisma.transaction.create({
      data: { ...minimal(), type: 'CASHBOX_TRANSFER', cashboxId, destinationCashboxId: cashboxId, cashboxLabel: 'Carro', destinationCashboxLabel: 'Carro' },
    });

    await prisma.cashbox.delete({ where: { id: cashboxId } });

    const after = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });
    expect(after).toMatchObject({ cashboxId: null, destinationCashboxId: null, cashboxLabel: 'Carro', destinationCashboxLabel: 'Carro' });
  });

  it('has exactly the four indexes declared in the schema', async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'transactions' AND indexname LIKE 'transactions_%_idx'
    `;

    expect(new Set(rows.map((r) => r.indexname))).toEqual(
      new Set([
        'transactions_user_id_reference_month_status_idx',
        'transactions_user_id_type_reference_month_idx',
        'transactions_user_id_category_id_reference_month_idx',
        'transactions_user_id_cashbox_id_idx',
      ]),
    );
  });

  it('has no externalHash or fundedByTransactionId column (ADR-0013, ADR-0008)', async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'transactions' AND column_name IN ('external_hash', 'funded_by_transaction_id')
    `;

    expect(rows).toEqual([]);
  });
});

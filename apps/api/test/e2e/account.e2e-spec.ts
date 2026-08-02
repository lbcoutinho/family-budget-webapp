import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validate } from '../../src/config/env.validation';
import { Prisma } from '../../src/generated/prisma/client';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for the first domain model and its migration (M3-T01). Requires a database
 * with the migrations applied (`docker compose up -d postgres` then
 * `pnpm --filter api db:migrate`), since every assertion here is a real round-trip.
 *
 * Same minimal graph as the `User` suite: `ConfigModule` + `PrismaModule`, no HTTP layer — the
 * endpoints arrive with M3-T02.
 */
describe('Account model (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;

  const emails = ['account.e2e@family-budget.test', 'account.e2e.other@family-budget.test'];

  // Accounts hold a foreign key onto the user with `onDelete: Restrict`, so they come off first.
  const removeFixtures = async (): Promise<void> => {
    await prisma.account.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
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

    const [owner, other] = await Promise.all(
      emails.map((email) => prisma.user.create({ data: { email, name: 'Test User', passwordHash: 'not-a-real-hash' }, select: { id: true } })),
    );

    userId = owner!.id;
    otherUserId = other!.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await moduleRef.close();
  });

  it('creates an account with the defaults the master-data pattern relies on', async () => {
    const created = await prisma.account.create({ data: { userId, name: 'Millennium', initialBalance: 150_000 } });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created).toMatchObject({ isActive: true, sortOrder: 0, initialBalance: 150_000 });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    await expect(prisma.account.findUnique({ where: { id: created.id } })).resolves.toEqual(created);
  });

  it('rejects a second account with the same name for the same user', async () => {
    await prisma.account.create({ data: { userId, name: 'Revolut' } });

    const duplicate = prisma.account.create({ data: { userId, name: 'Revolut' } });

    // P2002 — unique constraint violation, the error `PrismaExceptionFilter` maps to a 409.
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
    await expect(duplicate).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('allows two users to hold accounts with the same name', async () => {
    await prisma.account.create({ data: { userId, name: 'Revolut' } });
    await prisma.account.create({ data: { userId: otherUserId, name: 'Revolut' } });

    await expect(prisma.account.count({ where: { name: 'Revolut', userId: { in: [userId, otherUserId] } } })).resolves.toBe(2);
  });

  it('refuses to delete a user who still owns an account', async () => {
    await prisma.account.create({ data: { userId, name: 'Millennium' } });

    // P2003 — foreign key constraint. `onDelete: Restrict` is what keeps domain data from
    // disappearing with the user row.
    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('stores an integer number of cents, negative balances included', async () => {
    await prisma.account.create({ data: { userId, name: 'Millennium', initialBalance: -4_250 } });

    const rows = await prisma.$queryRaw<{ initial_balance: number; is_active: boolean; sort_order: number }[]>`
      SELECT initial_balance, is_active, sort_order FROM accounts WHERE user_id = ${userId}::uuid
    `;

    expect(rows).toEqual([{ initial_balance: -4_250, is_active: true, sort_order: 0 }]);
  });
});

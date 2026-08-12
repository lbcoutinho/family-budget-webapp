import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { seedUsers, type SeedCredentials } from '../../prisma/seed';
import { validate } from '../../src/config/env.validation';
import { HashService } from '../../src/modules/auth/hash.service';
import { toDemoEmail } from '../../src/modules/users/demo-email';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for the seed (M2-T02). Requires a database with the migrations applied
 * (`docker compose up -d postgres` then `pnpm --filter api db:migrate`).
 *
 * `seedUsers` is called directly with fixture credentials rather than through
 * `pnpm --filter api db:seed`, so the suite neither depends on `SEED_*` being set nor writes the
 * real account into whichever database the run points at.
 */
describe('Database seed (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const credentials: SeedCredentials = {
    email: 'seed.e2e@family-budget.test',
    password: 'owner-password',
    demoPassword: 'demo-password',
  };

  const demoEmail = toDemoEmail(credentials.email);
  const emails = [credentials.email, demoEmail];
  const hashService = new HashService();

  // argon2 is intentionally slow, and every run of the seed derives two hashes.
  jest.setTimeout(30_000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env', '../../.env'] }), PrismaModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);

    await moduleRef.init();
  });

  // Transactions hold `Restrict` foreign keys onto account/category, so they come off before those.
  // Every seeded row also holds a foreign key onto the user with `onDelete: Restrict`, so they come
  // off before that. Categories take two passes of their own: the self-referencing key is `Restrict`
  // too and is checked per row, so one `deleteMany` spanning parents and children fails with P2003.
  const removeFixtures = async (): Promise<void> => {
    const owner = { user: { email: { in: emails } } };

    await prisma.transaction.deleteMany({ where: owner });
    await prisma.account.deleteMany({ where: owner });
    await prisma.cashbox.deleteMany({ where: owner });
    await prisma.category.deleteMany({ where: { ...owner, parentId: { not: null } } });
    await prisma.category.deleteMany({ where: owner });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  };

  // The database is shared with local development, so the fixtures are removed on both sides of
  // the suite: a run interrupted halfway never breaks the next one.
  beforeEach(removeFixtures);

  afterAll(async () => {
    await removeFixtures();
    await moduleRef.close();
  });

  it('creates the owner and the demo account, with the demo address derived from the owner', async () => {
    const { owner, demo } = await seedUsers(prisma, credentials);

    expect(owner).toMatchObject({ email: credentials.email, name: 'seed.e2e', created: true });
    expect(demo).toMatchObject({ email: 'seed.e2e+demo@family-budget.test', name: 'Demo', created: true });

    const stored = await prisma.user.findMany({ where: { email: { in: emails } }, orderBy: { email: 'asc' } });
    expect(stored).toHaveLength(2);
  });

  it('hashes each account independently, so neither password verifies against the other row', async () => {
    await seedUsers(prisma, credentials);

    const ownerRow = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });
    const demoRow = await prisma.user.findUniqueOrThrow({ where: { email: demoEmail } });

    expect(ownerRow.passwordHash).not.toBe(demoRow.passwordHash);
    await expect(hashService.verify(ownerRow.passwordHash, credentials.password)).resolves.toBe(true);
    await expect(hashService.verify(demoRow.passwordHash, credentials.demoPassword)).resolves.toBe(true);
    await expect(hashService.verify(ownerRow.passwordHash, credentials.demoPassword)).resolves.toBe(false);
    await expect(hashService.verify(demoRow.passwordHash, credentials.password)).resolves.toBe(false);
  });

  it('gives the demo user the two sample accounts, and the owner none (M3-T01)', async () => {
    const { owner, demo } = await seedUsers(prisma, credentials);

    const accounts = await prisma.account.findMany({ where: { userId: demo.id }, orderBy: { sortOrder: 'asc' } });

    expect(accounts.map((account) => account.name)).toEqual(['Millennium', 'Revolut']);
    expect(accounts[0]).toMatchObject({ initialBalance: 150_000, isActive: true });

    // The owner's database is real data: the seed must never put sample rows in it.
    await expect(prisma.account.count({ where: { userId: owner.id } })).resolves.toBe(0);
  });

  it('gives the demo user the three sample cashboxes, and the owner none (M3-T09)', async () => {
    const { owner, demo } = await seedUsers(prisma, credentials);

    await expect(prisma.cashbox.count({ where: { userId: demo.id } })).resolves.toBe(3);
    // The owner's database is real data: the seed must never put sample rows in it.
    await expect(prisma.cashbox.count({ where: { userId: owner.id } })).resolves.toBe(0);
  });

  it('gives the demo user the sample category tree, and the owner none (M3-T03)', async () => {
    const { owner, demo } = await seedUsers(prisma, credentials);

    const roots = await prisma.category.findMany({
      where: { userId: demo.id, parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: { children: { orderBy: { sortOrder: 'asc' }, select: { name: true, kind: true, color: true } } },
    });

    expect(roots.map((root) => root.name)).toEqual(['Moradia', 'Transporte', 'Alimentação', 'Saúde', 'Lazer', 'Salário']);
    expect(roots[0]).toMatchObject({ kind: 'EXPENSE', color: '#1f6f54', isActive: true });
    // The income root is the one deliberately left without a colour.
    expect(roots.at(-1)).toMatchObject({ name: 'Salário', kind: 'INCOME', color: null });

    // Children inherit their parent's kind and carry no colour of their own.
    expect(roots[2]?.children).toEqual([
      { name: 'Supermercado', kind: 'EXPENSE', color: null },
      { name: 'Restaurante', kind: 'EXPENSE', color: null },
    ]);

    // The owner's database is real data: the seed must never put sample rows in it.
    await expect(prisma.category.count({ where: { userId: owner.id } })).resolves.toBe(0);
  });

  it('is idempotent: a second run updates both rows instead of duplicating or failing', async () => {
    const first = await seedUsers(prisma, credentials);
    const second = await seedUsers(prisma, credentials);

    expect(second.owner).toMatchObject({ id: first.owner.id, created: false });
    expect(second.demo).toMatchObject({ id: first.demo.id, created: false });

    await expect(prisma.user.count({ where: { email: { in: emails } } })).resolves.toBe(2);
    // The sample accounts are upserted too, so a second run must not double them.
    await expect(prisma.account.count({ where: { user: { email: { in: emails } } } })).resolves.toBe(2);
    // Same for the category tree: six roots and nine subcategories, once.
    await expect(prisma.category.count({ where: { user: { email: { in: emails } } } })).resolves.toBe(15);
    // Same for the cashboxes, once.
    await expect(prisma.cashbox.count({ where: { user: { email: { in: emails } } } })).resolves.toBe(3);
  });

  it('re-derives the hash on every run, so the stored value changes while the password still verifies', async () => {
    await seedUsers(prisma, credentials);
    const afterFirstRun = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });

    await seedUsers(prisma, credentials);
    const afterSecondRun = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });

    expect(afterSecondRun.passwordHash).not.toBe(afterFirstRun.passwordHash);
    await expect(hashService.verify(afterSecondRun.passwordHash, credentials.password)).resolves.toBe(true);
  });

  it('refuses to seed when both accounts would share a password', async () => {
    const shared = { ...credentials, demoPassword: credentials.password };

    await expect(seedUsers(prisma, shared)).rejects.toThrow(/SEED_DEMO_USER_PASSWORD must differ/);
    await expect(prisma.user.count({ where: { email: { in: emails } } })).resolves.toBe(0);
  });
});

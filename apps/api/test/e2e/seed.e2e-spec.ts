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

  // The seeded accounts hold a foreign key onto the user with `onDelete: Restrict`, so the rows
  // come off in that order.
  const removeFixtures = async (): Promise<void> => {
    await prisma.account.deleteMany({ where: { user: { email: { in: emails } } } });
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

  it('gives each user the two sample accounts (M3-T01)', async () => {
    const { owner } = await seedUsers(prisma, credentials);

    const accounts = await prisma.account.findMany({ where: { userId: owner.id }, orderBy: { sortOrder: 'asc' } });

    expect(accounts.map((account) => account.name)).toEqual(['Millennium', 'Revolut']);
    expect(accounts[0]).toMatchObject({ initialBalance: 150_000, isActive: true });
    await expect(prisma.account.count({ where: { user: { email: { in: emails } } } })).resolves.toBe(4);
  });

  it('is idempotent: a second run updates both rows instead of duplicating or failing', async () => {
    const first = await seedUsers(prisma, credentials);
    const second = await seedUsers(prisma, credentials);

    expect(second.owner).toMatchObject({ id: first.owner.id, created: false });
    expect(second.demo).toMatchObject({ id: first.demo.id, created: false });

    await expect(prisma.user.count({ where: { email: { in: emails } } })).resolves.toBe(2);
    // The sample accounts are upserted too, so a second run must not double them.
    await expect(prisma.account.count({ where: { user: { email: { in: emails } } } })).resolves.toBe(4);
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

import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { seedUser, type SeedCredentials } from '../../prisma/seed';
import { validate } from '../../src/config/env.validation';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/** Integration coverage for the single-user seed against a migrated test database. */
describe('Database seed (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const credentials: SeedCredentials = { email: 'seed.e2e@family-budget.test', password: 'owner-password' };
  const hashService = new HashService();

  jest.setTimeout(30_000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env', '../../.env'] }), PrismaModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
  });

  const removeFixtures = async (): Promise<void> => {
    const owner = { user: { email: credentials.email } };

    await prisma.transaction.deleteMany({ where: owner });
    await prisma.account.deleteMany({ where: owner });
    await prisma.cashbox.deleteMany({ where: owner });
    await prisma.category.deleteMany({ where: { ...owner, parentId: { not: null } } });
    await prisma.category.deleteMany({ where: owner });
    await prisma.user.deleteMany({ where: { email: credentials.email } });
  };

  beforeEach(removeFixtures);

  afterAll(async () => {
    await removeFixtures();
    await moduleRef.close();
  });

  it('creates one user with all development sample data', async () => {
    const user = await seedUser(prisma, credentials, true);

    expect(user).toMatchObject({ email: credentials.email, name: 'seed.e2e', created: true });
    await expect(prisma.user.count({ where: { email: credentials.email } })).resolves.toBe(1);
    await expect(prisma.account.count({ where: { userId: user.id } })).resolves.toBe(2);
    await expect(prisma.cashbox.count({ where: { userId: user.id } })).resolves.toBe(3);
    await expect(prisma.category.count({ where: { userId: user.id } })).resolves.toBe(15);
    await expect(prisma.transaction.count({ where: { userId: user.id } })).resolves.toBeGreaterThan(0);
  });

  it('creates only the user when sample data is disabled for production', async () => {
    const user = await seedUser(prisma, credentials, false);

    await expect(prisma.account.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.cashbox.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.category.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.transaction.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it('is idempotent and never duplicates sample data', async () => {
    const first = await seedUser(prisma, credentials, true);
    const second = await seedUser(prisma, credentials, true);

    expect(second).toMatchObject({ id: first.id, created: false });
    await expect(prisma.user.count({ where: { email: credentials.email } })).resolves.toBe(1);
    await expect(prisma.account.count({ where: { userId: first.id } })).resolves.toBe(2);
    await expect(prisma.category.count({ where: { userId: first.id } })).resolves.toBe(15);
    await expect(prisma.cashbox.count({ where: { userId: first.id } })).resolves.toBe(3);
  });

  it('re-derives the password hash on every run', async () => {
    await seedUser(prisma, credentials, false);
    const first = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });

    await seedUser(prisma, credentials, false);
    const second = await prisma.user.findUniqueOrThrow({ where: { email: credentials.email } });

    expect(second.passwordHash).not.toBe(first.passwordHash);
    await expect(hashService.verify(second.passwordHash, credentials.password)).resolves.toBe(true);
  });
});

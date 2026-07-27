import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validate } from '../../src/config/env.validation';
import { Prisma } from '../../src/generated/prisma/client';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for the first model and the first migration (M2-T01). Requires a database
 * with the migrations applied (`docker compose up -d postgres` then
 * `pnpm --filter api db:migrate`), since every assertion here is a real round-trip.
 *
 * The whole application is not booted: only `ConfigModule` and `PrismaModule`, which is the
 * smallest graph that exercises `PrismaService` the way the app does — validated environment,
 * `pg` driver adapter, `$connect` on module init.
 */
describe('User model (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  const email = 'user.e2e@family-budget.test';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env', '../../.env'] }), PrismaModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);

    // Runs the lifecycle hooks, which is what opens the connection pool.
    await moduleRef.init();
  });

  // The database is shared with local development, so the fixture is removed on both sides of
  // the suite: a run interrupted halfway never breaks the next one.
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await moduleRef.close();
  });

  it('creates a user and reads it back through PrismaService', async () => {
    const created = await prisma.user.create({
      data: { email, name: 'Test User', passwordHash: 'not-a-real-hash' },
    });

    const found = await prisma.user.findUnique({ where: { email } });

    expect(found).toEqual(created);
    expect(found?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(found?.name).toBe('Test User');
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a second user with the same email', async () => {
    await prisma.user.create({ data: { email, name: 'Test User', passwordHash: 'not-a-real-hash' } });

    const duplicate = prisma.user.create({ data: { email, name: 'Impostor', passwordHash: 'not-a-real-hash' } });

    // P2002 — unique constraint violation, the error `PrismaExceptionFilter` maps to a 409.
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
    await expect(duplicate).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('stores the model in a snake_case table with snake_case columns', async () => {
    await prisma.user.create({ data: { email, name: 'Test User', passwordHash: 'not-a-real-hash' } });

    const rows = await prisma.$queryRaw<{ email: string; password_hash: string }[]>`
      SELECT email, password_hash FROM users WHERE email = ${email}
    `;

    expect(rows).toEqual([{ email, password_hash: 'not-a-real-hash' }]);
  });
});

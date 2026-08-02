import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type AccountDto } from '../../src/modules/accounts/dto/account.dto';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * The accounts API over the real request pipeline and a real database (M3-T02). Requires the
 * migrations to have been applied (`docker compose up -d postgres` then `pnpm --filter api
 * db:migrate`).
 *
 * Two accounts sign in, because half of what this endpoint has to get right is that neither can see
 * the other: the isolation claims are only worth anything against a second real token.
 */
describe('Accounts API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;

  const password = 'correct horse battery staple';
  const emails = ['accounts.api.e2e@family-budget.test', 'accounts.api.e2e.other@family-budget.test'];

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const createAccount = async (body: Record<string, unknown>, as = token): Promise<AccountDto> =>
    (await authed('post', '/accounts', as).send(body).expect(201)).body as AccountDto;

  // Accounts hold a foreign key onto the user with `onDelete: Restrict`, so they come off first.
  const removeFixtures = async (): Promise<void> => {
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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Accounts E2E', passwordHash }, update: { passwordHash } });
    }

    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );

    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
  });

  // The database is shared with local development, so the fixtures are removed on both sides of the
  // suite: a run interrupted halfway never breaks the next one.
  beforeEach(removeFixtures);

  afterAll(async () => {
    await removeFixtures();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('refuses every route without a token', async () => {
    await request(server).get('/api/accounts').expect(401);
    await request(server).post('/api/accounts').send({ name: 'Millennium' }).expect(401);
  });

  describe('create', () => {
    it('creates an account and hands back the defaults', async () => {
      const created = await createAccount({ name: 'Millennium', initialBalance: 150_000 });

      expect(created).toMatchObject({ name: 'Millennium', initialBalance: 150_000, isActive: true, sortOrder: 0 });
      expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // The tenancy column is never part of the response body.
      expect(created).not.toHaveProperty('userId');
    });

    it('rejects a duplicate name for the same user with 409', async () => {
      await createAccount({ name: 'Revolut' });

      await authed('post', '/accounts').send({ name: 'Revolut' }).expect(409);
    });

    it('lets the two users hold accounts with the same name', async () => {
      await createAccount({ name: 'Revolut' });

      await authed('post', '/accounts', otherToken).send({ name: 'Revolut' }).expect(201);
    });

    it.each([
      ['an empty name', { name: '   ' }],
      ['a missing name', { initialBalance: 10 }],
      ['a fractional balance', { name: 'Millennium', initialBalance: 10.5 }],
      ['a field that does not exist', { name: 'Millennium', userId: 'someone-else' }],
    ])('rejects %s with 400', async (_case, body) => {
      await authed('post', '/accounts').send(body).expect(400);
    });
  });

  describe('list', () => {
    it('orders by sort order and then by name', async () => {
      await createAccount({ name: 'Wallet', sortOrder: 1 });
      await createAccount({ name: 'Revolut' });
      await createAccount({ name: 'Millennium' });

      const listed = (await authed('get', '/accounts').expect(200)).body as AccountDto[];

      expect(listed.map((a) => a.name)).toEqual(['Millennium', 'Revolut', 'Wallet']);
    });

    it('hides inactive accounts by default, and shows them on request', async () => {
      const retired = await createAccount({ name: 'Old Wallet' });

      await authed('patch', `/accounts/${retired.id}/deactivate`).expect(200);
      await createAccount({ name: 'Millennium' });

      const active = (await authed('get', '/accounts').expect(200)).body as AccountDto[];
      expect(active.map((a) => a.name)).toEqual(['Millennium']);

      const all = (await authed('get', '/accounts?includeInactive=true').expect(200)).body as AccountDto[];
      expect(all.map((a) => a.name)).toEqual(['Millennium', 'Old Wallet']);
    });

    // `?includeInactive=false` must mean false. Left to the ValidationPipe's coercion it would be a
    // non-empty string, and therefore true.
    it('treats includeInactive=false as false', async () => {
      const retired = await createAccount({ name: 'Old Wallet' });
      await authed('patch', `/accounts/${retired.id}/deactivate`).expect(200);

      const listed = (await authed('get', '/accounts?includeInactive=false').expect(200)).body as AccountDto[];

      expect(listed).toEqual([]);
    });

    it('returns one named inactive account alongside the active ones for includeId', async () => {
      const retired = await createAccount({ name: 'Old Wallet' });
      const alsoRetired = await createAccount({ name: 'Older Wallet' });

      await authed('patch', `/accounts/${retired.id}/deactivate`).expect(200);
      await authed('patch', `/accounts/${alsoRetired.id}/deactivate`).expect(200);
      await createAccount({ name: 'Millennium' });

      const listed = (await authed('get', `/accounts?includeId=${retired.id}`).expect(200)).body as AccountDto[];

      expect(listed.map((a) => a.name)).toEqual(['Millennium', 'Old Wallet']);
    });

    it('never shows another user their accounts', async () => {
      await createAccount({ name: 'Millennium' });

      await expect(authed('get', '/accounts', otherToken).expect(200)).resolves.toMatchObject({ body: [] });
    });
  });

  describe('read, update and deactivate one', () => {
    it('reads an account back by id', async () => {
      const created = await createAccount({ name: 'Millennium' });

      await expect(authed('get', `/accounts/${created.id}`).expect(200)).resolves.toMatchObject({ body: { id: created.id, name: 'Millennium' } });
    });

    it('applies a partial update', async () => {
      const created = await createAccount({ name: 'Millennium', initialBalance: 150_000 });

      const updated = (await authed('patch', `/accounts/${created.id}`).send({ name: 'Millennium BCP' }).expect(200)).body as AccountDto;

      expect(updated).toMatchObject({ name: 'Millennium BCP', initialBalance: 150_000 });
    });

    it('rejects renaming onto a name the user already uses', async () => {
      await createAccount({ name: 'Revolut' });
      const created = await createAccount({ name: 'Millennium' });

      await authed('patch', `/accounts/${created.id}`).send({ name: 'Revolut' }).expect(409);
    });

    it('round-trips deactivate and activate', async () => {
      const created = await createAccount({ name: 'Millennium' });

      await expect(authed('patch', `/accounts/${created.id}/deactivate`).expect(200)).resolves.toMatchObject({ body: { isActive: false } });
      await expect(authed('patch', `/accounts/${created.id}/activate`).expect(200)).resolves.toMatchObject({ body: { isActive: true } });
    });

    it('rejects an id that is not a uuid with 400', async () => {
      await authed('get', '/accounts/not-a-uuid').expect(400);
    });

    it('answers 404 for an id that does not exist', async () => {
      await authed('get', '/accounts/6f9619ff-8b86-d011-b42d-00c04fc964ff').expect(404);
    });
  });

  describe('delete', () => {
    it('deletes an account nothing references', async () => {
      const created = await createAccount({ name: 'Millennium' });

      await authed('delete', `/accounts/${created.id}`).expect(204);
      await authed('get', `/accounts/${created.id}`).expect(404);
    });
  });

  // Every by-id route, proven one by one rather than for a representative sample: 404 and not 403,
  // because a 403 would confirm to the other user that the id exists.
  describe("another user's account", () => {
    it.each([
      ['get', ''],
      ['patch', '/activate'],
      ['patch', '/deactivate'],
      ['delete', ''],
    ] as const)('answers 404 to %s %s', async (method, suffix) => {
      const created = await createAccount({ name: 'Millennium' });

      await authed(method, `/accounts/${created.id}${suffix}`, otherToken).expect(404);
    });

    it('answers 404 to a patch, and leaves the row untouched', async () => {
      const created = await createAccount({ name: 'Millennium' });

      await authed('patch', `/accounts/${created.id}`, otherToken).send({ name: 'Hijacked' }).expect(404);

      await expect(authed('get', `/accounts/${created.id}`).expect(200)).resolves.toMatchObject({ body: { name: 'Millennium' } });
    });
  });
});

import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type CashboxDto } from '../../src/modules/cashboxes/dto/cashbox.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * The cashboxes API over the real request pipeline and a real database (M3-T05). Requires the
 * migrations to have been applied (`docker compose up -d postgres` then `pnpm --filter api
 * db:migrate`).
 *
 * Two accounts sign in, because half of what this endpoint has to get right is that neither can see
 * the other: the isolation claims are only worth anything against a second real token.
 *
 * The 409 on a blocked delete is not covered here: nothing references a `Cashbox` until the
 * `Transaction` model lands in M4. The P2003 → 409 mapping is unit-tested in
 * `prisma-exception.filter.spec.ts`.
 */
describe('Cashboxes API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;

  const password = 'correct horse battery staple';
  const emails = ['cashboxes.api.e2e@family-budget.test', 'cashboxes.api.e2e.other@family-budget.test'];

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const createCashbox = async (body: Record<string, unknown>, as = token): Promise<CashboxDto> =>
    (await authed('post', '/cashboxes', as).send(body).expect(201)).body as CashboxDto;

  // Cashboxes hold a foreign key onto the user with `onDelete: Restrict`, so they come off first.
  const removeFixtures = async (): Promise<void> => {
    await prisma.cashbox.deleteMany({ where: { user: { email: { in: emails } } } });
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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Cashboxes E2E', passwordHash }, update: { passwordHash } });
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
    await request(server).get('/api/cashboxes').expect(401);
    await request(server).post('/api/cashboxes').send({ name: 'Fundo de emergência' }).expect(401);
  });

  describe('create', () => {
    it('creates a cashbox and hands back the defaults', async () => {
      const created = await createCashbox({ name: 'Fundo de emergência', description: 'Seis meses.', targetAmount: 500_000 });

      expect(created).toMatchObject({
        name: 'Fundo de emergência',
        description: 'Seis meses.',
        targetAmount: 500_000,
        isActive: true,
        sortOrder: 0,
      });
      // The tenancy column is never part of the response body.
      expect(created).not.toHaveProperty('userId');
    });

    it('accepts a cashbox with no goal at all', async () => {
      await expect(createCashbox({ name: 'Viagem' })).resolves.toMatchObject({ description: null, targetAmount: null });
    });

    it('accepts an explicit null goal', async () => {
      await expect(createCashbox({ name: 'Viagem', description: null, targetAmount: null })).resolves.toMatchObject({ targetAmount: null });
    });

    it('rejects a duplicate name for the same user with 409', async () => {
      await createCashbox({ name: 'Viagem' });

      await authed('post', '/cashboxes').send({ name: 'Viagem' }).expect(409);
    });

    it('lets the two users hold cashboxes with the same name', async () => {
      await createCashbox({ name: 'Viagem' });

      await authed('post', '/cashboxes', otherToken).send({ name: 'Viagem' }).expect(201);
    });

    it.each([
      ['an empty name', { name: '   ' }],
      ['a missing name', { targetAmount: 10 }],
      ['a fractional goal', { name: 'Viagem', targetAmount: 10.5 }],
      ['a negative goal', { name: 'Viagem', targetAmount: -1 }],
      ['a field that does not exist', { name: 'Viagem', userId: 'someone-else' }],
    ])('rejects %s with 400', async (_case, body) => {
      await authed('post', '/cashboxes').send(body).expect(400);
    });
  });

  describe('list', () => {
    it('orders by sort order and then by name', async () => {
      await createCashbox({ name: 'Viagem', sortOrder: 1 });
      await createCashbox({ name: 'Reserva' });
      await createCashbox({ name: 'Carro' });

      const listed = (await authed('get', '/cashboxes').expect(200)).body as CashboxDto[];

      expect(listed.map((c) => c.name)).toEqual(['Carro', 'Reserva', 'Viagem']);
    });

    it('hides inactive cashboxes by default, and shows them on request', async () => {
      const retired = await createCashbox({ name: 'Viagem antiga' });

      await authed('patch', `/cashboxes/${retired.id}/deactivate`).expect(200);
      await createCashbox({ name: 'Carro' });

      const active = (await authed('get', '/cashboxes').expect(200)).body as CashboxDto[];
      expect(active.map((c) => c.name)).toEqual(['Carro']);

      const all = (await authed('get', '/cashboxes?includeInactive=true').expect(200)).body as CashboxDto[];
      expect(all.map((c) => c.name)).toEqual(['Carro', 'Viagem antiga']);
    });

    // `?includeInactive=false` must mean false. Left to the ValidationPipe's coercion it would be a
    // non-empty string, and therefore true.
    it('treats includeInactive=false as false', async () => {
      const retired = await createCashbox({ name: 'Viagem antiga' });
      await authed('patch', `/cashboxes/${retired.id}/deactivate`).expect(200);

      await expect(authed('get', '/cashboxes?includeInactive=false').expect(200)).resolves.toMatchObject({ body: [] });
    });

    it('returns one named inactive cashbox alongside the active ones for includeId', async () => {
      const retired = await createCashbox({ name: 'Viagem antiga' });
      const alsoRetired = await createCashbox({ name: 'Viagem mais antiga' });

      await authed('patch', `/cashboxes/${retired.id}/deactivate`).expect(200);
      await authed('patch', `/cashboxes/${alsoRetired.id}/deactivate`).expect(200);
      await createCashbox({ name: 'Carro' });

      const listed = (await authed('get', `/cashboxes?includeId=${retired.id}`).expect(200)).body as CashboxDto[];

      expect(listed.map((c) => c.name)).toEqual(['Carro', 'Viagem antiga']);
    });

    it('never shows another user their cashboxes', async () => {
      await createCashbox({ name: 'Carro' });

      await expect(authed('get', '/cashboxes', otherToken).expect(200)).resolves.toMatchObject({ body: [] });
    });
  });

  describe('read, update and deactivate one', () => {
    it('reads a cashbox back by id', async () => {
      const created = await createCashbox({ name: 'Carro' });

      await expect(authed('get', `/cashboxes/${created.id}`).expect(200)).resolves.toMatchObject({ body: { id: created.id, name: 'Carro' } });
    });

    it('applies a partial update', async () => {
      const created = await createCashbox({ name: 'Carro', targetAmount: 500_000 });

      const updated = (await authed('patch', `/cashboxes/${created.id}`).send({ name: 'Carro novo' }).expect(200)).body as CashboxDto;

      expect(updated).toMatchObject({ name: 'Carro novo', targetAmount: 500_000 });
    });

    it('clears the goal when null is sent explicitly', async () => {
      const created = await createCashbox({ name: 'Carro', description: 'Entrada', targetAmount: 500_000 });

      await expect(authed('patch', `/cashboxes/${created.id}`).send({ description: null, targetAmount: null }).expect(200)).resolves.toMatchObject({
        body: { description: null, targetAmount: null },
      });
    });

    it('rejects renaming onto a name the user already uses', async () => {
      await createCashbox({ name: 'Viagem' });
      const created = await createCashbox({ name: 'Carro' });

      await authed('patch', `/cashboxes/${created.id}`).send({ name: 'Viagem' }).expect(409);
    });

    it('round-trips deactivate and activate', async () => {
      const created = await createCashbox({ name: 'Carro' });

      await expect(authed('patch', `/cashboxes/${created.id}/deactivate`).expect(200)).resolves.toMatchObject({ body: { isActive: false } });
      await expect(authed('patch', `/cashboxes/${created.id}/activate`).expect(200)).resolves.toMatchObject({ body: { isActive: true } });
    });

    it('rejects an id that is not a uuid with 400', async () => {
      await authed('get', '/cashboxes/not-a-uuid').expect(400);
    });

    it('answers 404 for an id that does not exist', async () => {
      await authed('get', '/cashboxes/6f9619ff-8b86-d011-b42d-00c04fc964ff').expect(404);
    });
  });

  it('deletes a cashbox nothing references', async () => {
    const created = await createCashbox({ name: 'Carro' });

    await authed('delete', `/cashboxes/${created.id}`).expect(204);
    await authed('get', `/cashboxes/${created.id}`).expect(404);
  });

  // Every by-id route, proven one by one rather than for a representative sample: 404 and not 403,
  // because a 403 would confirm to the other user that the id exists.
  describe("another user's cashbox", () => {
    it.each([
      ['get', ''],
      ['patch', '/activate'],
      ['patch', '/deactivate'],
      ['delete', ''],
    ] as const)('answers 404 to %s %s', async (method, suffix) => {
      const created = await createCashbox({ name: 'Carro' });

      await authed(method, `/cashboxes/${created.id}${suffix}`, otherToken).expect(404);
    });

    it('answers 404 to a patch, and leaves the row untouched', async () => {
      const created = await createCashbox({ name: 'Carro' });

      await authed('patch', `/cashboxes/${created.id}`, otherToken).send({ name: 'Hijacked' }).expect(404);

      await expect(authed('get', `/cashboxes/${created.id}`).expect(200)).resolves.toMatchObject({ body: { name: 'Carro' } });
    });
  });
});

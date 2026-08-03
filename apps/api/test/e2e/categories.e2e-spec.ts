import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CategoryKind } from '../../src/generated/prisma/client';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { DEFAULT_SUBCATEGORY_NAME } from '../../src/modules/categories/categories.service';
import { type CategoryDto } from '../../src/modules/categories/dto/category.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * The categories API over the real request pipeline and a real database (M3-T04). Requires the
 * migrations to have been applied (`docker compose up -d postgres` then `pnpm --filter api
 * db:migrate`).
 *
 * Two accounts sign in, because half of what this endpoint has to get right is that neither can see
 * the other. What the unit suite cannot prove lives here: the automatic "Outros" as the API really
 * writes it, the partial unique index on root names, and the deactivation cascade as rows.
 */
describe('Categories API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;
  let otherToken: string;

  const password = 'correct horse battery staple';
  const emails = ['categories.api.e2e@family-budget.test', 'categories.api.e2e.other@family-budget.test'];

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);

  const createCategory = async (body: Record<string, unknown>, as = token): Promise<CategoryDto> =>
    (await authed('post', '/categories', as).send(body).expect(201)).body as CategoryDto;

  /** A root and one subcategory of its own, on top of the "Outros" the API adds. */
  const createTree = async (name = 'Alimentação'): Promise<{ root: CategoryDto; sub: CategoryDto }> => {
    const root = await createCategory({ name, kind: CategoryKind.EXPENSE });
    const sub = await createCategory({ name: 'Supermercado', parentId: root.id });

    return { root, sub };
  };

  const list = async (query = '', as = token): Promise<CategoryDto[]> => (await authed('get', `/categories${query}`, as).expect(200)).body as CategoryDto[];

  // The self-relation is `onDelete: Restrict` and PostgreSQL checks it per row, so a single
  // `deleteMany` spanning both levels fails with P2003: subcategories first, then the roots.
  const removeFixtures = async (): Promise<void> => {
    const where = { user: { email: { in: emails } } };

    await prisma.category.deleteMany({ where: { ...where, parentId: { not: null } } });
    await prisma.category.deleteMany({ where });
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
      await prisma.user.upsert({ where: { email }, create: { email, name: 'Categories E2E', passwordHash }, update: { passwordHash } });
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
    await request(server).get('/api/categories').expect(401);
    await request(server).post('/api/categories').send({ name: 'Alimentação', kind: CategoryKind.EXPENSE }).expect(401);
  });

  describe('create', () => {
    it('ships a new root with an automatic Outros subcategory', async () => {
      const root = await createCategory({ name: 'Alimentação', kind: CategoryKind.EXPENSE, color: '#a85c1a' });

      expect(root).toMatchObject({ parentId: null, kind: CategoryKind.EXPENSE, color: '#a85c1a', isActive: true });
      expect(root).not.toHaveProperty('userId');

      const listed = await list();

      expect(listed.filter((c) => c.parentId === root.id)).toMatchObject([{ name: DEFAULT_SUBCATEGORY_NAME, kind: CategoryKind.EXPENSE, color: null }]);
    });

    it('creates a subcategory with its parent kind, and no Outros of its own', async () => {
      const { root, sub } = await createTree();

      expect(sub).toMatchObject({ parentId: root.id, kind: CategoryKind.EXPENSE });

      const listed = await list();

      expect(
        listed
          .filter((c) => c.parentId === root.id)
          .map((c) => c.name)
          .sort(),
      ).toEqual([DEFAULT_SUBCATEGORY_NAME, 'Supermercado']);
    });

    it('rejects a subcategory under a subcategory with 400', async () => {
      const { sub } = await createTree();

      await authed('post', '/categories').send({ name: 'Marmelada', parentId: sub.id }).expect(400);
    });

    it('rejects a second root with the same name with 409', async () => {
      await createCategory({ name: 'Alimentação', kind: CategoryKind.EXPENSE });

      // The partial index `category_root_name_unique` — `@@unique([userId, parentId, name])` alone
      // would let this through, because `NULL != NULL` in PostgreSQL.
      await authed('post', '/categories').send({ name: 'Alimentação', kind: CategoryKind.EXPENSE }).expect(409);
    });

    it('rejects a duplicate subcategory under the same parent, and allows it under another', async () => {
      const { root } = await createTree();
      const other = await createCategory({ name: 'Lazer', kind: CategoryKind.EXPENSE });

      await authed('post', '/categories').send({ name: 'Supermercado', parentId: root.id }).expect(409);
      await authed('post', '/categories').send({ name: 'Supermercado', parentId: other.id }).expect(201);
    });

    it('lets the two users hold roots with the same name', async () => {
      await createCategory({ name: 'Alimentação', kind: CategoryKind.EXPENSE });

      await authed('post', '/categories', otherToken).send({ name: 'Alimentação', kind: CategoryKind.EXPENSE }).expect(201);
    });

    it.each([
      ['an empty name', { name: '   ', kind: CategoryKind.EXPENSE }],
      ['a root without a kind', { name: 'Alimentação' }],
      ['a kind that is not one of the two', { name: 'Alimentação', kind: 'CASHBOX' }],
      ['a colour that is not #RRGGBB', { name: 'Alimentação', kind: CategoryKind.EXPENSE, color: 'coral' }],
      ['a three-digit colour', { name: 'Alimentação', kind: CategoryKind.EXPENSE, color: '#abc' }],
      ['a parentId that is not a uuid', { name: 'Alimentação', kind: CategoryKind.EXPENSE, parentId: 'root' }],
      ['a field that does not exist', { name: 'Alimentação', kind: CategoryKind.EXPENSE, userId: 'someone-else' }],
    ])('rejects %s with 400', async (_case, body) => {
      await authed('post', '/categories').send(body).expect(400);
    });

    it('rejects a subcategory carrying its own colour or a contradicting kind with 400', async () => {
      const { root } = await createTree();

      await authed('post', '/categories').send({ name: 'Restaurante', parentId: root.id, color: '#a85c1a' }).expect(400);
      await authed('post', '/categories').send({ name: 'Restaurante', parentId: root.id, kind: CategoryKind.INCOME }).expect(400);
    });
  });

  describe('list', () => {
    it('returns a flat list by default and a nested one for tree=true', async () => {
      const { root } = await createTree();

      const flat = await list();

      expect(flat).toHaveLength(3);
      expect(flat.every((c) => c.children === undefined)).toBe(true);

      const tree = await list('?tree=true');

      expect(tree).toHaveLength(1);
      expect(tree[0]?.id).toBe(root.id);
      expect(tree[0]?.children?.map((c) => c.name).sort()).toEqual([DEFAULT_SUBCATEGORY_NAME, 'Supermercado']);
    });

    it('hides inactive categories by default, and shows them on request', async () => {
      const { root } = await createTree();

      await authed('patch', `/categories/${root.id}/deactivate`).expect(200);

      await expect(list()).resolves.toEqual([]);
      await expect(list('?includeInactive=true')).resolves.toHaveLength(3);
    });

    // `?includeInactive=false` must mean false. Left to the ValidationPipe's coercion it would be a
    // non-empty string, and therefore true.
    it('treats includeInactive=false as false', async () => {
      const { root } = await createTree();

      await authed('patch', `/categories/${root.id}/deactivate`).expect(200);

      await expect(list('?includeInactive=false')).resolves.toEqual([]);
    });

    it('returns one named inactive category alongside the active ones for includeId', async () => {
      const { root } = await createTree();
      const retired = await createCategory({ name: 'Lazer', kind: CategoryKind.EXPENSE });

      await authed('patch', `/categories/${retired.id}/deactivate`).expect(200);

      const listed = await list(`?includeId=${retired.id}`);

      expect(listed.map((c) => c.id)).toContain(retired.id);
      expect(listed.map((c) => c.id)).toContain(root.id);
    });

    it('never shows another user their categories', async () => {
      await createTree();

      await expect(list('', otherToken)).resolves.toEqual([]);
    });
  });

  describe('update', () => {
    it('applies a partial update', async () => {
      const { root } = await createTree();

      const updated = (await authed('patch', `/categories/${root.id}`).send({ name: 'Comida', color: '#1f6f54' }).expect(200)).body as CategoryDto;

      expect(updated).toMatchObject({ name: 'Comida', color: '#1f6f54', kind: CategoryKind.EXPENSE });
    });

    it("carries a root's kind change down to its subcategories", async () => {
      const { root } = await createTree();

      await authed('patch', `/categories/${root.id}`).send({ kind: CategoryKind.INCOME }).expect(200);

      const listed = await list();

      expect(listed.every((c) => c.kind === CategoryKind.INCOME)).toBe(true);
    });

    it('refuses a kind change on a subcategory with 400', async () => {
      const { sub } = await createTree();

      await authed('patch', `/categories/${sub.id}`).send({ kind: CategoryKind.INCOME }).expect(400);
    });

    it('refuses to turn a category that has subcategories into one with 409', async () => {
      const { root } = await createTree();
      const other = await createCategory({ name: 'Lazer', kind: CategoryKind.EXPENSE });

      await authed('patch', `/categories/${root.id}`).send({ parentId: other.id }).expect(409);
    });

    it('moves a childless subcategory to another root', async () => {
      const { sub } = await createTree();
      const other = await createCategory({ name: 'Lazer', kind: CategoryKind.EXPENSE });

      await expect(authed('patch', `/categories/${sub.id}`).send({ parentId: other.id }).expect(200)).resolves.toMatchObject({
        body: { parentId: other.id },
      });
    });

    it('rejects renaming a root onto a name the user already uses with 409', async () => {
      await createCategory({ name: 'Lazer', kind: CategoryKind.EXPENSE });
      const { root } = await createTree();

      await authed('patch', `/categories/${root.id}`).send({ name: 'Lazer' }).expect(409);
    });

    it('answers 404 for an id that does not exist, and 400 for one that is not a uuid', async () => {
      await authed('get', '/categories/not-a-uuid').expect(400);
      await authed('get', '/categories/6f9619ff-8b86-d011-b42d-00c04fc964ff').expect(404);
    });
  });

  describe('activate and deactivate', () => {
    it('takes the subcategories with the root, both ways', async () => {
      const { root } = await createTree();

      await authed('patch', `/categories/${root.id}/deactivate`).expect(200);

      const retired = await list('?includeInactive=true');
      expect(retired.every((c) => !c.isActive)).toBe(true);

      await authed('patch', `/categories/${root.id}/activate`).expect(200);

      const back = await list('?includeInactive=true');
      expect(back.every((c) => c.isActive)).toBe(true);
    });

    it('deactivates a subcategory that has an active sibling', async () => {
      const { sub } = await createTree();

      await expect(authed('patch', `/categories/${sub.id}/deactivate`).expect(200)).resolves.toMatchObject({ body: { isActive: false } });
    });

    it('refuses to deactivate the last active subcategory of an active root with 409', async () => {
      const { root, sub } = await createTree();
      const outros = (await list()).find((c) => c.parentId === root.id && c.name === DEFAULT_SUBCATEGORY_NAME);

      await authed('patch', `/categories/${sub.id}/deactivate`).expect(200);

      await authed('patch', `/categories/${outros!.id}/deactivate`).expect(409);
    });
  });

  describe('delete', () => {
    it('deletes a subcategory nothing references', async () => {
      const { sub } = await createTree();

      await authed('delete', `/categories/${sub.id}`).expect(204);
      await authed('get', `/categories/${sub.id}`).expect(404);
    });

    it('refuses to delete a root that still holds subcategories with 409', async () => {
      const { root } = await createTree();

      await authed('delete', `/categories/${root.id}`).expect(409);
    });
  });

  // Every by-id route, proven one by one rather than for a representative sample: 404 and not 403,
  // because a 403 would confirm to the other user that the id exists.
  describe("another user's category", () => {
    it.each([
      ['get', ''],
      ['patch', '/activate'],
      ['patch', '/deactivate'],
      ['delete', ''],
    ] as const)('answers 404 to %s %s', async (method, suffix) => {
      const { sub } = await createTree();

      await authed(method, `/categories/${sub.id}${suffix}`, otherToken).expect(404);
    });

    it('answers 404 to a patch, and leaves the row untouched', async () => {
      const { root } = await createTree();

      await authed('patch', `/categories/${root.id}`, otherToken).send({ name: 'Hijacked' }).expect(404);

      await expect(authed('get', `/categories/${root.id}`).expect(200)).resolves.toMatchObject({ body: { name: 'Alimentação' } });
    });

    it('refuses to create a subcategory under a parent that is not theirs', async () => {
      const { root } = await createTree();

      await authed('post', '/categories', otherToken).send({ name: 'Supermercado', parentId: root.id }).expect(404);
    });
  });
});

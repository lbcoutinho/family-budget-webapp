import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { validate } from '../../src/config/env.validation';
import { CategoryKind, Prisma } from '../../src/generated/prisma/client';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Integration coverage for the category tree and its two uniqueness constraints (M3-T03). Requires
 * a database with the migrations applied (`docker compose up -d postgres` then
 * `pnpm --filter api db:migrate`), since the point of every assertion here is what PostgreSQL does.
 *
 * Uniqueness is enforced by two indexes, not one: `categories_user_id_parent_id_name_key` covers
 * subcategories, and the hand-written partial index `category_root_name_unique` covers roots,
 * which the composite cannot because `NULL != NULL`. The tests name the constraint they expect, so
 * a migration that quietly drops the partial one fails here instead of in production.
 *
 * Same minimal graph as the `Account` suite: `ConfigModule` + `PrismaModule`, no HTTP layer — the
 * endpoints, the two-level rule and the automatic "Outros" arrive with M3-T04.
 */
describe('Category model (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let userId: string;
  let otherUserId: string;

  const emails = ['category.e2e@family-budget.test', 'category.e2e.other@family-budget.test'];

  /** A root category for the fixture user, with the fields every test would otherwise repeat. */
  const createRoot = (name: string, ownerId = userId): Promise<{ id: string }> =>
    prisma.category.create({ data: { userId: ownerId, name, kind: CategoryKind.EXPENSE }, select: { id: true } });

  // Categories point at their parent with `onDelete: Restrict`, and the check is immediate and per
  // row: a single `deleteMany` covering parents and children fails with P2003. So the children go
  // first, then the roots, then the users they hang off.
  const removeFixtures = async (): Promise<void> => {
    const owner = { user: { email: { in: emails } } };

    await prisma.category.deleteMany({ where: { ...owner, parentId: { not: null } } });
    await prisma.category.deleteMany({ where: owner });
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

  it('creates a root category with the defaults the master-data pattern relies on', async () => {
    const created = await prisma.category.create({ data: { userId, name: 'Alimentação', kind: CategoryKind.EXPENSE } });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created).toMatchObject({ parentId: null, color: null, isActive: true, sortOrder: 0, kind: 'EXPENSE' });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it('rejects a second root with the same name for the same user', async () => {
    await createRoot('Alimentação');

    const duplicate = prisma.category.create({ data: { userId, name: 'Alimentação', kind: CategoryKind.EXPENSE } });

    // The partial index is the only thing standing here — `(userId, parentId, name)` does not
    // constrain two NULL parents, so this test is also what fails if the migration's raw SQL ever
    // stops being applied.
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
    await expect(duplicate).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('keeps the hand-written partial index on root names', async () => {
    // The behaviour above already covers it, but a dropped index would leave that test failing
    // with no hint why. This one names the missing object. Prisma 7 routes errors through the
    // driver adapter and no longer reports `meta.target`, so the catalogue is what gets asked.
    const [index] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'categories' AND indexname = 'category_root_name_unique'
    `;

    expect(index?.indexdef).toContain('WHERE (parent_id IS NULL)');
  });

  it('rejects a root whose name repeats an existing one even under a different kind', async () => {
    await createRoot('Extras');

    const duplicate = prisma.category.create({ data: { userId, name: 'Extras', kind: CategoryKind.INCOME } });

    // `kind` is not part of either index: a name is unique per level, whichever side it is on.
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows two users to hold a root with the same name', async () => {
    await createRoot('Alimentação');
    await createRoot('Alimentação', otherUserId);

    await expect(prisma.category.count({ where: { name: 'Alimentação', userId: { in: [userId, otherUserId] } } })).resolves.toBe(2);
  });

  it('allows the same subcategory name under two different parents', async () => {
    const [food, transport] = await Promise.all([createRoot('Alimentação'), createRoot('Transporte')]);

    await prisma.category.create({ data: { userId, parentId: food.id, name: 'Outros', kind: CategoryKind.EXPENSE } });
    await prisma.category.create({ data: { userId, parentId: transport.id, name: 'Outros', kind: CategoryKind.EXPENSE } });

    await expect(prisma.category.count({ where: { userId, name: 'Outros' } })).resolves.toBe(2);
  });

  it('rejects two subcategories with the same name under the same parent', async () => {
    const food = await createRoot('Alimentação');

    await prisma.category.create({ data: { userId, parentId: food.id, name: 'Supermercado', kind: CategoryKind.EXPENSE } });

    const duplicate = prisma.category.create({ data: { userId, parentId: food.id, name: 'Supermercado', kind: CategoryKind.EXPENSE } });

    // Here it is the composite unique that fires: both rows share a non-null parent.
    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows a subcategory to carry its parent’s name', async () => {
    const housing = await createRoot('Moradia');

    // Different level, so neither index applies — and the prototypes rely on it: "Água, luz e gás"
    // sits under a root that could plausibly share a name with one of its children.
    await prisma.category.create({ data: { userId, parentId: housing.id, name: 'Moradia', kind: CategoryKind.EXPENSE } });

    await expect(prisma.category.count({ where: { userId, name: 'Moradia' } })).resolves.toBe(2);
  });

  it('reads a tree back through the self relation', async () => {
    const food = await createRoot('Alimentação');

    await prisma.category.create({ data: { userId, parentId: food.id, name: 'Supermercado', kind: CategoryKind.EXPENSE, sortOrder: 1 } });
    await prisma.category.create({ data: { userId, parentId: food.id, name: 'Restaurante', kind: CategoryKind.EXPENSE, sortOrder: 2 } });

    const root = await prisma.category.findUniqueOrThrow({
      where: { id: food.id },
      include: { children: { orderBy: { sortOrder: 'asc' }, select: { name: true, parentId: true } } },
    });

    expect(root.children).toEqual([
      { name: 'Supermercado', parentId: food.id },
      { name: 'Restaurante', parentId: food.id },
    ]);
  });

  it('refuses to delete a category that still has children', async () => {
    const food = await createRoot('Alimentação');

    await prisma.category.create({ data: { userId, parentId: food.id, name: 'Supermercado', kind: CategoryKind.EXPENSE } });

    // P2003 — the self-referencing foreign key is `Restrict`, so a tree is dismantled leaf first
    // and never disappears as a side effect of deleting its root.
    await expect(prisma.category.delete({ where: { id: food.id } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('refuses to delete a user who still owns a category', async () => {
    await createRoot('Alimentação');

    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('stores kind as the category_kind enum and parent_id as a real uuid column', async () => {
    // Colour on the root only, the way the seed writes it: a subcategory inherits it in the charts.
    const food = await prisma.category.create({
      data: { userId, name: 'Alimentação', kind: CategoryKind.EXPENSE, color: '#a85c1a' },
      select: { id: true },
    });

    await prisma.category.create({ data: { userId, parentId: food.id, name: 'Supermercado', kind: CategoryKind.EXPENSE } });

    const rows = await prisma.$queryRaw<{ name: string; kind: string; parent_id: string | null; type_name: string; color: string | null }[]>`
      SELECT c.name, c.kind::text AS kind, c.parent_id, c.color, t.typname AS type_name
      FROM categories c
      JOIN pg_type t ON t.oid = (SELECT atttypid FROM pg_attribute WHERE attrelid = 'categories'::regclass AND attname = 'kind')
      WHERE c.user_id = ${userId}::uuid
      ORDER BY c.parent_id NULLS FIRST
    `;

    expect(rows).toEqual([
      { name: 'Alimentação', kind: 'EXPENSE', parent_id: null, color: '#a85c1a', type_name: 'category_kind' },
      { name: 'Supermercado', kind: 'EXPENSE', parent_id: food.id, color: null, type_name: 'category_kind' },
    ]);
  });
});

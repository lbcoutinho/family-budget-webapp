import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { type Category, CategoryKind } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { CategoriesService, DEFAULT_SUBCATEGORY_NAME } from './categories.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const rootId = '33333333-3333-3333-3333-333333333333';
const childId = '44444444-4444-4444-4444-444444444444';

const row = (overrides: Partial<Category> = {}): Category => ({
  id: rootId,
  userId,
  parentId: null,
  name: 'Alimentação',
  kind: CategoryKind.EXPENSE,
  color: '#a85c1a',
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-07-01T10:00:00.000Z'),
  updatedAt: new Date('2026-07-02T10:00:00.000Z'),
  ...overrides,
});

const child = (overrides: Partial<Category> = {}): Category => row({ id: childId, parentId: rootId, name: 'Supermercado', color: null, ...overrides });

type Delegate = Record<'findMany' | 'findUnique' | 'count' | 'create' | 'update' | 'updateMany' | 'delete', jest.Mock>;

/**
 * Only the delegate methods the service touches. `$transaction` hands the callback the same double,
 * so a test asserting on `create` sees the writes made inside a transaction as well as outside it.
 */
const prismaDouble = (): { prisma: PrismaService; category: Delegate } => {
  const category: Delegate = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };

  const prisma = {
    category,
    $transaction: jest.fn((run: (tx: unknown) => unknown) => run({ category })),
  };

  return { prisma: prisma as unknown as PrismaService, category };
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let category: Delegate;

  beforeEach(() => {
    const double = prismaDouble();

    category = double.category;
    service = new CategoriesService(double.prisma);
  });

  describe('findAll', () => {
    it('hides inactive categories by default and orders by sort order then name', async () => {
      category.findMany.mockResolvedValue([row()]);

      await expect(service.findAll(userId, {})).resolves.toEqual([
        {
          id: rootId,
          parentId: null,
          name: 'Alimentação',
          kind: CategoryKind.EXPENSE,
          color: '#a85c1a',
          isActive: true,
          sortOrder: 0,
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      ]);

      expect(category.findMany).toHaveBeenCalledWith({
        where: { userId, OR: [{ isActive: true }] },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('drops the visibility filter entirely for includeInactive', async () => {
      category.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: true });

      expect(category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    });

    // A branch of `{ id: undefined }` would match every row, inactive ones included.
    it('never emits an OR branch with an undefined id', async () => {
      category.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: false, includeId: undefined });

      expect(category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }] } }));
    });

    it('leaves children undefined in the flat list', async () => {
      category.findMany.mockResolvedValue([row(), child()]);

      const listed = await service.findAll(userId, {});

      expect(listed).toHaveLength(2);
      expect(listed[0]).not.toHaveProperty('children');
    });

    it('nests subcategories under their root for tree=true', async () => {
      category.findMany.mockResolvedValue([row(), child(), child({ id: '55555555-5555-5555-5555-555555555555', name: 'Restaurante' })]);

      const [tree, ...rest] = await service.findAll(userId, { tree: true });

      expect(rest).toEqual([]);
      expect(tree?.id).toBe(rootId);
      expect(tree?.children?.map((c) => c.name)).toEqual(['Supermercado', 'Restaurante']);
    });

    // `?includeId` on a subcategory returns it without its root; promoting it would claim a root
    // that does not exist.
    it('drops a subcategory whose root was filtered out', async () => {
      category.findMany.mockResolvedValue([child()]);

      await expect(service.findAll(userId, { tree: true })).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    it('creates a root together with its automatic Outros, in one transaction', async () => {
      category.create.mockResolvedValueOnce(row()).mockResolvedValueOnce(child({ name: DEFAULT_SUBCATEGORY_NAME }));

      await expect(service.create(userId, { name: 'Alimentação', kind: CategoryKind.EXPENSE })).resolves.toMatchObject({ id: rootId });

      expect(category.create).toHaveBeenNthCalledWith(1, { data: { name: 'Alimentação', kind: CategoryKind.EXPENSE, userId } });
      expect(category.create).toHaveBeenNthCalledWith(2, {
        data: { userId, parentId: rootId, name: DEFAULT_SUBCATEGORY_NAME, kind: CategoryKind.EXPENSE },
      });
    });

    it('rejects a root without a kind', async () => {
      await expect(service.create(userId, { name: 'Alimentação' })).rejects.toThrow(BadRequestException);
      expect(category.create).not.toHaveBeenCalled();
    });

    it('creates a subcategory with the kind inherited from its parent, and no Outros of its own', async () => {
      category.findUnique.mockResolvedValue(row());
      category.create.mockResolvedValue(child());

      await service.create(userId, { name: 'Supermercado', parentId: rootId });

      expect(category.create).toHaveBeenCalledTimes(1);
      expect(category.create).toHaveBeenCalledWith({ data: { name: 'Supermercado', parentId: rootId, kind: CategoryKind.EXPENSE, userId } });
    });

    it('refuses a third level', async () => {
      category.findUnique.mockResolvedValue(child());

      await expect(service.create(userId, { name: 'Marmelada', parentId: childId })).rejects.toThrow(BadRequestException);
      expect(category.create).not.toHaveBeenCalled();
    });

    it('refuses a subcategory whose kind contradicts its parent', async () => {
      category.findUnique.mockResolvedValue(row());

      await expect(service.create(userId, { name: 'Supermercado', parentId: rootId, kind: CategoryKind.INCOME })).rejects.toThrow(BadRequestException);
    });

    it('refuses a colour on a subcategory', async () => {
      category.findUnique.mockResolvedValue(row());

      await expect(service.create(userId, { name: 'Supermercado', parentId: rootId, color: '#a85c1a' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('applies a partial update to a root', async () => {
      category.findUnique.mockResolvedValue(row());
      category.update.mockResolvedValue(row({ name: 'Comida' }));

      await expect(service.update(userId, rootId, { name: 'Comida' })).resolves.toMatchObject({ name: 'Comida' });
      expect(category.update).toHaveBeenCalledWith({ where: { id: rootId }, data: { name: 'Comida' } });
      expect(category.updateMany).not.toHaveBeenCalled();
    });

    it("carries a root's kind change down to its subcategories", async () => {
      category.findUnique.mockResolvedValue(row());
      category.update.mockResolvedValue(row({ kind: CategoryKind.INCOME }));

      await service.update(userId, rootId, { kind: CategoryKind.INCOME });

      expect(category.updateMany).toHaveBeenCalledWith({ where: { parentId: rootId }, data: { kind: CategoryKind.INCOME } });
    });

    it('refuses a kind change on a subcategory', async () => {
      category.findUnique.mockResolvedValue(child());

      await expect(service.update(userId, childId, { kind: CategoryKind.INCOME })).rejects.toThrow(BadRequestException);
      expect(category.update).not.toHaveBeenCalled();
    });

    it('refuses to turn a category that has subcategories into one', async () => {
      const otherRootId = '66666666-6666-6666-6666-666666666666';

      category.findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ id: otherRootId }));
      category.count.mockResolvedValue(2);

      await expect(service.update(userId, rootId, { parentId: otherRootId })).rejects.toThrow(ConflictException);
      expect(category.update).not.toHaveBeenCalled();
    });

    it('refuses to make a category its own parent', async () => {
      category.findUnique.mockResolvedValue(child());

      await expect(service.update(userId, childId, { parentId: childId })).rejects.toThrow(BadRequestException);
    });
  });

  describe('setActive', () => {
    it('takes the subcategories with the root, both ways', async () => {
      category.findUnique.mockResolvedValue(row());
      category.update.mockResolvedValue(row({ isActive: false }));

      await service.setActive(userId, rootId, false);

      expect(category.update).toHaveBeenCalledWith({ where: { id: rootId }, data: { isActive: false } });
      expect(category.updateMany).toHaveBeenCalledWith({ where: { parentId: rootId }, data: { isActive: false } });
    });

    it('deactivates a subcategory that has an active sibling', async () => {
      category.findUnique.mockResolvedValueOnce(child()).mockResolvedValueOnce(row());
      category.count.mockResolvedValue(1);
      category.update.mockResolvedValue(child({ isActive: false }));

      await expect(service.setActive(userId, childId, false)).resolves.toMatchObject({ isActive: false });
      expect(category.count).toHaveBeenCalledWith({ where: { parentId: rootId, isActive: true, id: { not: childId } } });
    });

    it('refuses to deactivate the last active subcategory of an active root', async () => {
      category.findUnique.mockResolvedValueOnce(child()).mockResolvedValueOnce(row());
      category.count.mockResolvedValue(0);

      await expect(service.setActive(userId, childId, false)).rejects.toThrow(ConflictException);
      expect(category.update).not.toHaveBeenCalled();
    });

    // An inactive root needs nowhere to put a transaction, so the invariant does not apply.
    it('allows deactivating the last subcategory of an already retired root', async () => {
      category.findUnique.mockResolvedValueOnce(child()).mockResolvedValueOnce(row({ isActive: false }));
      category.count.mockResolvedValue(0);
      category.update.mockResolvedValue(child({ isActive: false }));

      await expect(service.setActive(userId, childId, false)).resolves.toMatchObject({ isActive: false });
    });

    it('never runs the last-subcategory check when activating', async () => {
      category.findUnique.mockResolvedValue(child());
      category.update.mockResolvedValue(child({ isActive: true }));

      await service.setActive(userId, childId, true);

      expect(category.count).not.toHaveBeenCalled();
    });
  });

  describe('ownership', () => {
    it.each([
      ['findOne', () => service.findOne(userId, rootId)],
      ['update', () => service.update(userId, rootId, { name: 'Renamed' })],
      ['setActive', () => service.setActive(userId, rootId, false)],
      ['remove', () => service.remove(userId, rootId)],
    ])("answers 404, not 403, when %s hits another user's category", async (_name, call) => {
      category.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(call()).rejects.toThrow(NotFoundException);
      expect(category.update).not.toHaveBeenCalled();
      expect(category.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for a parent that belongs to someone else, rather than creating under it', async () => {
      category.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(service.create(userId, { name: 'Supermercado', parentId: rootId })).rejects.toThrow(NotFoundException);
      expect(category.create).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      category.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, rootId)).rejects.toThrow(NotFoundException);
    });
  });

  it('deletes for real rather than soft-deleting', async () => {
    category.findUnique.mockResolvedValue(row());
    category.delete.mockResolvedValue(row());

    await service.remove(userId, rootId);

    expect(category.delete).toHaveBeenCalledWith({ where: { id: rootId } });
    expect(category.update).not.toHaveBeenCalled();
  });

  // The database is the authority on "still referenced" — a root still holding subcategories, and
  // from M4 a category still holding transactions. P2003 is left for `PrismaExceptionFilter`.
  it('lets the foreign-key error from a blocked delete propagate untouched', async () => {
    const blocked = Object.assign(new Error('foreign key constraint'), { code: 'P2003' });

    category.findUnique.mockResolvedValue(row());
    category.delete.mockRejectedValue(blocked);

    await expect(service.remove(userId, rootId)).rejects.toBe(blocked);
  });
});

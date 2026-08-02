import { NotFoundException } from '@nestjs/common';

import { type Account } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { AccountsService } from './accounts.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const accountId = '33333333-3333-3333-3333-333333333333';

const row = (overrides: Partial<Account> = {}): Account => ({
  id: accountId,
  userId,
  name: 'Millennium',
  initialBalance: 150_000,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-07-01T10:00:00.000Z'),
  updatedAt: new Date('2026-07-02T10:00:00.000Z'),
  ...overrides,
});

/** Only the four delegate methods the service touches. */
const prismaDouble = (): { prisma: PrismaService; account: Record<'findMany' | 'findUnique' | 'create' | 'update' | 'delete', jest.Mock> } => {
  const account = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  return { prisma: { account } as unknown as PrismaService, account };
};

describe('AccountsService', () => {
  let service: AccountsService;
  let account: ReturnType<typeof prismaDouble>['account'];

  beforeEach(() => {
    const double = prismaDouble();

    account = double.account;
    service = new AccountsService(double.prisma);
  });

  describe('findAll', () => {
    it('hides inactive accounts by default and orders by sort order then name', async () => {
      account.findMany.mockResolvedValue([row()]);

      await expect(service.findAll(userId, {})).resolves.toEqual([
        {
          id: accountId,
          name: 'Millennium',
          initialBalance: 150_000,
          isActive: true,
          sortOrder: 0,
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      ]);

      expect(account.findMany).toHaveBeenCalledWith({
        where: { userId, OR: [{ isActive: true }] },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('drops the visibility filter entirely for includeInactive', async () => {
      account.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: true });

      expect(account.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    });

    it('lets includeId through alongside the active ones', async () => {
      account.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeId: accountId });

      expect(account.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }, { id: accountId }] } }));
    });

    // A branch of `{ id: undefined }` would match every row, inactive ones included — the exact
    // leak the array-building in `visibility()` exists to avoid.
    it('never emits an OR branch with an undefined id', async () => {
      account.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: false, includeId: undefined });

      expect(account.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }] } }));
    });
  });

  describe('ownership', () => {
    it.each([
      ['findOne', () => service.findOne(userId, accountId)],
      ['update', () => service.update(userId, accountId, { name: 'Renamed' })],
      ['setActive', () => service.setActive(userId, accountId, false)],
      ['remove', () => service.remove(userId, accountId)],
    ])("answers 404, not 403, when %s hits another user's account", async (_name, call) => {
      account.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(call()).rejects.toThrow(NotFoundException);
      expect(account.update).not.toHaveBeenCalled();
      expect(account.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      account.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, accountId)).rejects.toThrow(NotFoundException);
    });
  });

  it('creates with the userId from the token, never from the body', async () => {
    account.create.mockResolvedValue(row());

    await service.create(userId, { name: 'Millennium', initialBalance: 150_000 });

    expect(account.create).toHaveBeenCalledWith({ data: { name: 'Millennium', initialBalance: 150_000, userId } });
  });

  it('updates a row it owns', async () => {
    account.findUnique.mockResolvedValue(row());
    account.update.mockResolvedValue(row({ name: 'Renamed' }));

    await expect(service.update(userId, accountId, { name: 'Renamed' })).resolves.toMatchObject({ name: 'Renamed' });
    expect(account.update).toHaveBeenCalledWith({ where: { id: accountId }, data: { name: 'Renamed' } });
  });

  it.each([
    ['activate', true],
    ['deactivate', false],
  ])('flips isActive for %s', async (_name, isActive) => {
    account.findUnique.mockResolvedValue(row());
    account.update.mockResolvedValue(row({ isActive }));

    await expect(service.setActive(userId, accountId, isActive)).resolves.toMatchObject({ isActive });
    expect(account.update).toHaveBeenCalledWith({ where: { id: accountId }, data: { isActive } });
  });

  it('deletes for real rather than soft-deleting', async () => {
    account.findUnique.mockResolvedValue(row());
    account.delete.mockResolvedValue(row());

    await service.remove(userId, accountId);

    expect(account.delete).toHaveBeenCalledWith({ where: { id: accountId } });
    // Not a disguised deactivation: nothing was written to `isActive`.
    expect(account.update).not.toHaveBeenCalled();
  });

  // The database is the authority on "still referenced", so the service does not pre-check —
  // it lets P2003 out for `PrismaExceptionFilter` to turn into the 409.
  it('lets the foreign-key error from a blocked delete propagate untouched', async () => {
    const blocked = Object.assign(new Error('foreign key constraint'), { code: 'P2003' });

    account.findUnique.mockResolvedValue(row());
    account.delete.mockRejectedValue(blocked);

    await expect(service.remove(userId, accountId)).rejects.toBe(blocked);
  });
});

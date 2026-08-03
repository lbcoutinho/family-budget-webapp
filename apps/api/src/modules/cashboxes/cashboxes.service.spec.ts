import { NotFoundException } from '@nestjs/common';

import { type Cashbox } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { CashboxesService } from './cashboxes.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const cashboxId = '33333333-3333-3333-3333-333333333333';

const row = (overrides: Partial<Cashbox> = {}): Cashbox => ({
  id: cashboxId,
  userId,
  name: 'Fundo de emergência',
  description: 'Seis meses de despesas fixas.',
  targetAmount: 500_000,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-07-01T10:00:00.000Z'),
  updatedAt: new Date('2026-07-02T10:00:00.000Z'),
  ...overrides,
});

/** Only the five delegate methods the service touches. */
const prismaDouble = (): { prisma: PrismaService; cashbox: Record<'findMany' | 'findUnique' | 'create' | 'update' | 'delete', jest.Mock> } => {
  const cashbox = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  return { prisma: { cashbox } as unknown as PrismaService, cashbox };
};

describe('CashboxesService', () => {
  let service: CashboxesService;
  let cashbox: ReturnType<typeof prismaDouble>['cashbox'];

  beforeEach(() => {
    const double = prismaDouble();

    cashbox = double.cashbox;
    service = new CashboxesService(double.prisma);
  });

  describe('findAll', () => {
    it('hides inactive cashboxes by default and orders by sort order then name', async () => {
      cashbox.findMany.mockResolvedValue([row()]);

      await expect(service.findAll(userId, {})).resolves.toEqual([
        {
          id: cashboxId,
          name: 'Fundo de emergência',
          description: 'Seis meses de despesas fixas.',
          targetAmount: 500_000,
          isActive: true,
          sortOrder: 0,
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        },
      ]);

      expect(cashbox.findMany).toHaveBeenCalledWith({
        where: { userId, OR: [{ isActive: true }] },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    });

    it('keeps a goalless cashbox null rather than turning it into a zero', async () => {
      cashbox.findMany.mockResolvedValue([row({ description: null, targetAmount: null })]);

      await expect(service.findAll(userId, {})).resolves.toMatchObject([{ description: null, targetAmount: null }]);
    });

    it('drops the visibility filter entirely for includeInactive', async () => {
      cashbox.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: true });

      expect(cashbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    });

    it('lets includeId through alongside the active ones', async () => {
      cashbox.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeId: cashboxId });

      expect(cashbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }, { id: cashboxId }] } }));
    });

    // A branch of `{ id: undefined }` would match every row, inactive ones included — the exact
    // leak the array-building in `visibility()` exists to avoid.
    it('never emits an OR branch with an undefined id', async () => {
      cashbox.findMany.mockResolvedValue([]);

      await service.findAll(userId, { includeInactive: false, includeId: undefined });

      expect(cashbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId, OR: [{ isActive: true }] } }));
    });
  });

  describe('ownership', () => {
    it.each([
      ['findOne', () => service.findOne(userId, cashboxId)],
      ['update', () => service.update(userId, cashboxId, { name: 'Renamed' })],
      ['setActive', () => service.setActive(userId, cashboxId, false)],
      ['remove', () => service.remove(userId, cashboxId)],
    ])("answers 404, not 403, when %s hits another user's cashbox", async (_name, call) => {
      cashbox.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(call()).rejects.toThrow(NotFoundException);
      expect(cashbox.update).not.toHaveBeenCalled();
      expect(cashbox.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      cashbox.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, cashboxId)).rejects.toThrow(NotFoundException);
    });
  });

  it('creates with the userId from the token, never from the body', async () => {
    cashbox.create.mockResolvedValue(row());

    await service.create(userId, { name: 'Fundo de emergência', targetAmount: 500_000 });

    expect(cashbox.create).toHaveBeenCalledWith({ data: { name: 'Fundo de emergência', targetAmount: 500_000, userId } });
  });

  it('passes an explicit null through, so an edit can clear the goal', async () => {
    cashbox.findUnique.mockResolvedValue(row());
    cashbox.update.mockResolvedValue(row({ targetAmount: null }));

    await expect(service.update(userId, cashboxId, { targetAmount: null })).resolves.toMatchObject({ targetAmount: null });
    expect(cashbox.update).toHaveBeenCalledWith({ where: { id: cashboxId }, data: { targetAmount: null } });
  });

  it.each([
    ['activate', true],
    ['deactivate', false],
  ])('flips isActive for %s', async (_name, isActive) => {
    cashbox.findUnique.mockResolvedValue(row());
    cashbox.update.mockResolvedValue(row({ isActive }));

    await expect(service.setActive(userId, cashboxId, isActive)).resolves.toMatchObject({ isActive });
    expect(cashbox.update).toHaveBeenCalledWith({ where: { id: cashboxId }, data: { isActive } });
  });

  it('deletes for real rather than soft-deleting', async () => {
    cashbox.findUnique.mockResolvedValue(row());
    cashbox.delete.mockResolvedValue(row());

    await service.remove(userId, cashboxId);

    expect(cashbox.delete).toHaveBeenCalledWith({ where: { id: cashboxId } });
    // Not a disguised deactivation: nothing was written to `isActive`.
    expect(cashbox.update).not.toHaveBeenCalled();
  });

  // The database is the authority on "still referenced", so the service does not pre-check —
  // it lets P2003 out for `PrismaExceptionFilter` to turn into the 409.
  it('lets the foreign-key error from a blocked delete propagate untouched', async () => {
    const blocked = Object.assign(new Error('foreign key constraint'), { code: 'P2003' });

    cashbox.findUnique.mockResolvedValue(row());
    cashbox.delete.mockRejectedValue(blocked);

    await expect(service.remove(userId, cashboxId)).rejects.toBe(blocked);
  });
});

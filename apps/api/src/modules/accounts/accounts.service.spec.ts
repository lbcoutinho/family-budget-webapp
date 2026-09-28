import { NotFoundException } from '@nestjs/common';

import { type Account } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';
import { type BalancesService } from '../transactions/balances.service';

import { AccountsService } from './accounts.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const accountId = '33333333-3333-3333-3333-333333333333';

type AccountRow = Account & { financialInstitution: null; initialBalances: [] };

const row = (overrides: Partial<Account> = {}): AccountRow => ({
  id: accountId,
  userId,
  name: 'Millennium',
  kind: 'BANK',
  financialInstitutionId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-07-01T10:00:00.000Z'),
  updatedAt: new Date('2026-07-02T10:00:00.000Z'),
  ...overrides,
  financialInstitution: null,
  initialBalances: [],
});

/** Only the four delegate methods the service touches. */
const prismaDouble = (): {
  prisma: PrismaService;
  account: Record<'findMany' | 'findUnique' | 'findUniqueOrThrow' | 'create' | 'update' | 'delete', jest.Mock>;
  instrument: { findMany: jest.Mock };
  financialInstitution: { findFirst: jest.Mock };
} => {
  const account = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const instrument = { findMany: jest.fn().mockResolvedValue([]) };
  const financialInstitution = { findFirst: jest.fn() };
  const accountInitialBalance = { deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() };
  const transaction = jest.fn((callback: (client: PrismaService) => Promise<unknown>) => callback(prisma));
  const prisma = { account, instrument, financialInstitution, accountInitialBalance, $transaction: transaction } as unknown as PrismaService;
  return { prisma, account, instrument, financialInstitution };
};

describe('AccountsService', () => {
  let service: AccountsService;
  let account: ReturnType<typeof prismaDouble>['account'];
  let instrument: ReturnType<typeof prismaDouble>['instrument'];
  let financialInstitution: ReturnType<typeof prismaDouble>['financialInstitution'];
  let instrumentBalances: jest.Mock;

  beforeEach(() => {
    const double = prismaDouble();

    account = double.account;
    instrument = double.instrument;
    financialInstitution = double.financialInstitution;
    instrumentBalances = jest.fn().mockResolvedValue([]);
    service = new AccountsService(double.prisma, { instrumentBalances } as unknown as BalancesService);
  });

  describe('findAll', () => {
    it('hides inactive accounts by default and orders by sort order then name', async () => {
      account.findMany.mockResolvedValue([row()]);

      await expect(service.findAll(userId, {})).resolves.toEqual([
        expect.objectContaining({
          id: accountId,
          name: 'Millennium',
          isActive: true,
          sortOrder: 0,
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z',
        }),
      ]);

      expect(account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, OR: [{ isActive: true }] },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
      );
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

    await service.create(userId, { name: 'Millennium', kind: 'OTHER' });

    expect(account.create).toHaveBeenCalled();
  });

  it.each(['BANK', 'BROKERAGE', 'EXCHANGE'] as const)('requires an active institution for a %s account', async (kind) => {
    await expect(service.create(userId, { name: 'Custody', kind })).rejects.toMatchObject({ response: { code: 'ACCOUNT_INSTITUTION_REQUIRED' } });
    expect(account.create).not.toHaveBeenCalled();
  });

  it.each([
    ['BANK', 'FIAT', true],
    ['BANK', 'CRYPTOCURRENCY', false],
    ['BROKERAGE', 'ETF', true],
    ['BROKERAGE', 'CRYPTOCURRENCY', false],
    ['WALLET', 'CRYPTOCURRENCY', true],
    ['WALLET', 'FIAT', false],
    ['EXCHANGE', 'CRYPTOCURRENCY', true],
    ['OTHER', 'STOCK', true],
  ] as const)('allows %s initial balances with %s instruments only when compatible', async (kind, type, allowed) => {
    financialInstitution.findFirst.mockResolvedValue({ id: 'institution' });
    instrument.findMany.mockResolvedValue([{ id: 'instrument', type }]);
    account.create.mockResolvedValue(row({ kind, financialInstitutionId: kind === 'WALLET' || kind === 'OTHER' ? null : 'institution' }));
    const dto = {
      name: 'Custody',
      kind,
      financialInstitutionId: kind === 'WALLET' || kind === 'OTHER' ? null : 'institution',
      initialBalances: [{ instrumentId: 'instrument', quantity: '1' }],
    };

    if (allowed) {
      await expect(service.create(userId, dto)).resolves.toMatchObject({ kind });
    } else {
      await expect(service.create(userId, dto)).rejects.toMatchObject({ response: { code: 'ACCOUNT_INSTRUMENT_INCOMPATIBLE' } });
    }
  });

  it('requires an institution when a legacy bank account is edited', async () => {
    account.findUnique.mockResolvedValue(row({ kind: 'BANK', financialInstitutionId: null }));

    await expect(service.update(userId, accountId, { name: 'Renamed' })).rejects.toMatchObject({ response: { code: 'ACCOUNT_INSTITUTION_REQUIRED' } });
    expect(account.update).not.toHaveBeenCalled();
  });

  it('updates a row it owns', async () => {
    account.findUnique.mockResolvedValue(row({ kind: 'OTHER' }));
    account.update.mockResolvedValue(row({ name: 'Renamed', kind: 'OTHER' }));

    await expect(service.update(userId, accountId, { name: 'Renamed' })).resolves.toMatchObject({ name: 'Renamed' });
    expect(account.update).toHaveBeenCalled();
  });

  it('activates an account without reading its balance', async () => {
    account.findUnique.mockResolvedValue(row());
    account.update.mockResolvedValue(row({ isActive: true }));

    await expect(service.setActive(userId, accountId, true)).resolves.toMatchObject({ isActive: true });
    expect(instrumentBalances).not.toHaveBeenCalled();
    expect(account.update).toHaveBeenCalled();
  });

  it('deactivates an account with a zero confirmed balance', async () => {
    account.findUnique.mockResolvedValue(row());
    account.update.mockResolvedValue(row({ isActive: false }));

    await expect(service.setActive(userId, accountId, false)).resolves.toMatchObject({ isActive: false });
    expect(instrumentBalances).toHaveBeenCalledWith(userId);
    expect(account.update).toHaveBeenCalled();
  });

  it.each([
    ['positive', 1_000],
    ['negative', -1_000],
  ])('refuses to deactivate an account with a %s confirmed balance', async (_name, balance) => {
    account.findUnique.mockResolvedValue(row());
    instrumentBalances.mockResolvedValue([{ accountId, quantity: { isZero: () => balance === 0 } }]);

    await expect(service.setActive(userId, accountId, false)).rejects.toMatchObject({
      response: { code: 'ACCOUNT_NOT_EMPTY' },
    });
    expect(account.update).not.toHaveBeenCalled();
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

import { Prisma } from '../../generated/prisma/client';

import { type MarketQuoteProvider } from './eodhd-quote.provider';
import { InvestmentsService } from './investments.service';

const listing = { id: 'listing', userId: 'user', providerSymbol: 'IWDA.AS', quoteInstrumentId: 'eur', isActive: true };

describe('InvestmentsService quote synchronization', () => {
  const provider = (quote: ReturnType<MarketQuoteProvider['quote']>): MarketQuoteProvider => ({
    isConfigured: () => true,
    quote: jest.fn().mockReturnValue(quote),
  });

  it('stores a provider quote once and skips it on the same day', async () => {
    const sync = { assetListingId: listing.id, status: 'SUCCESS', attemptCount: 1, attemptedAt: new Date('2026-09-25T10:00:00.000Z') };
    const prisma = {
      assetListing: { findMany: jest.fn().mockResolvedValue([listing]) },
      marketQuoteSync: { findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([sync]), upsert: jest.fn().mockResolvedValue(sync) },
      marketQuote: { upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
    };
    const quotes = provider(Promise.resolve({ price: '123.45', marketDate: new Date('2026-09-24T00:00:00.000Z') }));
    const service = new InvestmentsService(prisma as never, {} as never, quotes);

    await service.synchronizeQuotes('user', false, new Date('2026-09-25T10:00:00.000Z'));
    await service.synchronizeQuotes('user', false, new Date('2026-09-25T11:00:00.000Z'));

    expect(quotes.quote).toHaveBeenCalledTimes(1);
    expect(prisma.marketQuote.upsert).toHaveBeenCalledTimes(1);
  });

  it('retries a failed quote but never a successful one', async () => {
    const prisma = {
      assetListing: { findMany: jest.fn().mockResolvedValue([listing, { ...listing, id: 'successful' }]) },
      marketQuoteSync: {
        findMany: jest.fn().mockResolvedValue([
          { assetListingId: listing.id, status: 'FAILED', attemptCount: 1, attemptedAt: new Date('2026-09-25T10:00:00.000Z') },
          { assetListingId: 'successful', status: 'SUCCESS', attemptCount: 1, attemptedAt: new Date('2026-09-25T10:00:00.000Z') },
        ]),
        upsert: jest.fn(),
      },
      marketQuote: { upsert: jest.fn(), updateMany: jest.fn() },
    };
    const quotes = provider(Promise.resolve(null));

    await new InvestmentsService(prisma as never, {} as never, quotes).synchronizeQuotes('user', true, new Date('2026-09-25T11:00:00.000Z'));

    expect(quotes.quote).toHaveBeenCalledTimes(1);
    expect(quotes.quote).toHaveBeenCalledWith('IWDA.AS');
  });
});

describe('InvestmentsService reconciliation adjustments', () => {
  const account = { id: 'account', userId: 'user', isActive: true, name: 'Broker', kind: 'BROKERAGE' };
  const asset = { id: 'asset', userId: 'user', isActive: true, type: 'STOCK', code: 'IWDA' };
  const currency = { id: 'currency', userId: 'user', isActive: true, type: 'FIAT', code: 'EUR' };
  const provider = { isConfigured: () => false } as MarketQuoteProvider;

  const adjustment = (instrument = asset, quantity = '2', cost: string | null = '100') => ({
    id: 'adjustment',
    userId: 'user',
    accountId: account.id,
    instrumentId: instrument.id,
    quantity: new Prisma.Decimal(quantity),
    cost: cost === null ? null : new Prisma.Decimal(cost),
    effectiveAt: new Date('2026-09-01T00:00:00.000Z'),
    reason: 'Broker correction',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    account: { name: account.name },
    instrument: { code: instrument.code },
  });

  const setup = ({ activeInstrument = asset, held = '0' }: { activeInstrument?: typeof asset; held?: string } = {}) => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue(account) },
      instrument: { findFirst: jest.fn().mockResolvedValue(activeInstrument) },
      positionAdjustment: {
        create: jest.fn().mockResolvedValue(adjustment()),
        update: jest.fn().mockResolvedValue(adjustment()),
        findUnique: jest.fn().mockResolvedValue(adjustment()),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ accountId: account.id, instrumentId: asset.id }),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
      },
      balanceAdjustment: {
        create: jest.fn().mockResolvedValue(adjustment(currency, '50', null)),
        update: jest.fn().mockResolvedValue(adjustment(currency, '50', null)),
        findUnique: jest.fn().mockResolvedValue(adjustment(currency, '50', null)),
        delete: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };
    Object.assign(prisma, { $transaction: jest.fn((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) });
    const balances = {
      instrumentBalances: jest.fn().mockResolvedValue([{ accountId: account.id, instrumentId: activeInstrument.id, quantity: new Prisma.Decimal(held) }]),
    };
    return { prisma, balances, service: new InvestmentsService(prisma as never, balances as never, provider) };
  };

  it('creates positive positions with cost and negative positions without cost', async () => {
    const { service, prisma } = setup({ held: '4' });

    await expect(
      service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity: '2',
        cost: 100,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).resolves.toBeDefined();
    await expect(
      service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity: '-2',
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).resolves.toBeDefined();

    expect(prisma.positionAdjustment.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    { quantity: '0', cost: undefined },
    { quantity: '2', cost: undefined },
    { quantity: '-2', cost: 100 },
  ])('rejects invalid position adjustment quantities', async ({ quantity, cost }) => {
    const { service } = setup();

    await expect(
      service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity,
        cost,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).rejects.toThrow('weighted-average cost');
  });

  it('rejects inactive and non-investment position references', async () => {
    const inactive = setup({ activeInstrument: { ...asset, isActive: false } });
    inactive.prisma.instrument.findFirst.mockResolvedValue(null);
    await expect(
      inactive.service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity: '2',
        cost: 100,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).rejects.toThrow('investment asset');

    const fiat = setup({ activeInstrument: currency });
    await expect(
      fiat.service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: currency.id,
        quantity: '2',
        cost: 100,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).rejects.toThrow('investment asset');
  });

  it('rejects negative position history and permits currency balance adjustments', async () => {
    const insufficient = setup({ held: '-1' });
    insufficient.prisma.positionAdjustment.findMany.mockResolvedValue([{ effectiveAt: new Date('2026-09-01T00:00:00.000Z') }]);
    await expect(
      insufficient.service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity: '-1',
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).rejects.toThrow('position negative');

    const balance = setup({ activeInstrument: currency });
    await expect(
      balance.service.createBalanceAdjustment('user', {
        accountId: account.id,
        instrumentId: currency.id,
        quantity: '50',
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Bank correction',
      }),
    ).resolves.toMatchObject({ quantity: '50', cost: null });
  });

  it('rejects investment assets as balance adjustments', async () => {
    const { service } = setup();

    await expect(
      service.createBalanceAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity: '50',
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Bank correction',
      }),
    ).rejects.toThrow('currency instrument');
  });

  it('rejects operation account kinds that cannot hold them', async () => {
    const position = setup();
    position.prisma.account.findFirst.mockResolvedValue({ ...account, kind: 'BANK' });
    await expect(
      position.service.createPositionAdjustment('user', {
        accountId: account.id,
        instrumentId: asset.id,
        quantity: '2',
        cost: 100,
        effectiveAt: '2026-09-01T00:00:00.000Z',
        reason: 'Broker correction',
      }),
    ).rejects.toThrow('Brokerage, Exchange, or Wallet');

    const trade = setup();
    trade.prisma.account.findFirst.mockResolvedValue({ ...account, kind: 'WALLET' });
    await expect(
      trade.service.createTrade('user', {
        accountId: account.id,
        acquiredInstrumentId: asset.id,
        acquiredQuantity: '2',
        disposedInstrumentId: currency.id,
        disposedQuantity: '100',
        executedAt: '2026-09-01T00:00:00.000Z',
        executionValue: 100,
      }),
    ).rejects.toThrow('Brokerage or Exchange');
  });

  it('updates and removes reconciliation adjustments', async () => {
    const { service, prisma } = setup();
    prisma.positionAdjustment.findUnique.mockResolvedValue(adjustment());
    prisma.balanceAdjustment.findUnique.mockResolvedValue(adjustment(currency, '50', null));
    prisma.instrument.findFirst.mockResolvedValueOnce(asset).mockResolvedValueOnce(currency);

    await expect(service.updatePositionAdjustment('user', 'adjustment', {})).resolves.toMatchObject({ quantity: '2' });
    await expect(service.updateBalanceAdjustment('user', 'adjustment', {})).resolves.toMatchObject({ quantity: '50', cost: null });
    await service.removePositionAdjustment('user', 'adjustment');
    await service.removeBalanceAdjustment('user', 'adjustment');

    expect(prisma.positionAdjustment.update).toHaveBeenCalledTimes(1);
    expect(prisma.positionAdjustment.delete).toHaveBeenCalledTimes(1);
    expect(prisma.balanceAdjustment.update).toHaveBeenCalledTimes(1);
    expect(prisma.balanceAdjustment.delete).toHaveBeenCalledTimes(1);
  });
});

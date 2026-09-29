import { InvestmentImportService } from './investment-import.service';

const csv = `external_id,executed_at_utc,institution,account,acquired_instrument,acquired_quantity,disposed_instrument,disposed_quantity,fee_instrument,fee_quantity,fee_value_eur_cents,asset_listing_ticker,asset_listing_market,execution_value_eur_cents,notes\ntrade-1,2026-01-01T12:00:00Z,Kraken,Spot,BTC,0.01,EUR,100,,,,,,10000,first`;

describe('InvestmentImportService', () => {
  it('simulates a normalized trade without persistence', async () => {
    const prisma = {
      account: { findMany: jest.fn().mockResolvedValue([{ id: 'account', name: 'Spot', kind: 'EXCHANGE', financialInstitution: { name: 'Kraken' } }]) },
      instrument: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'eur', code: 'EUR', type: 'FIAT' },
          { id: 'btc', code: 'BTC', type: 'CRYPTOCURRENCY' },
        ]),
      },
      financialInstitution: { findMany: jest.fn().mockResolvedValue([{ name: 'Kraken' }]) },
      assetListing: { findMany: jest.fn().mockResolvedValue([]) },
      investmentTrade: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const balances = {
      instrumentBalances: jest
        .fn()
        .mockResolvedValue([{ accountId: 'account', instrumentId: 'eur', quantity: '100', instrumentName: 'Euro', instrumentCode: 'EUR' }]),
    };

    const result = await new InvestmentImportService(prisma as never, balances as never, {} as never).preview('user', Buffer.from(csv));

    expect(result.errors).toEqual([]);
    expect(result.balances).toEqual(expect.arrayContaining([expect.objectContaining({ accountName: 'Spot', instrumentCode: 'EUR', quantity: '0' })]));
    expect(result.positions).toEqual([expect.objectContaining({ accountName: 'Spot', instrumentCode: 'BTC', quantity: '0.01', remainingCost: 10000 })]);
  });

  it('reports every invalid row and never requests a write', async () => {
    const prisma = {
      account: { findMany: jest.fn().mockResolvedValue([]) },
      instrument: { findMany: jest.fn().mockResolvedValue([]) },
      financialInstitution: { findMany: jest.fn().mockResolvedValue([]) },
      assetListing: { findMany: jest.fn().mockResolvedValue([]) },
      investmentTrade: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await new InvestmentImportService(prisma as never, { instrumentBalances: jest.fn().mockResolvedValue([]) } as never, {} as never).preview(
      'user',
      Buffer.from(`${csv}\ntrade-1,2026-01-01T12:00:00,Kraken,Spot,BTC,0,EUR,0,,,,,,0,,unexpected`),
    );

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['COLUMN_COUNT_INVALID', 'EXTERNAL_ID_DUPLICATE', 'UTC_REQUIRED', 'ACCOUNT_UNKNOWN', 'INSTRUMENT_INVALID']),
    );
    expect(prisma).not.toHaveProperty('$transaction');
  });

  it('simulates imported history before persisted trades', async () => {
    const prisma = {
      account: { findMany: jest.fn().mockResolvedValue([{ id: 'account', name: 'Spot', kind: 'BANK', financialInstitution: { name: 'Kraken' } }]) },
      instrument: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'eur', code: 'EUR', type: 'FIAT' },
          { id: 'eth', code: 'ETH', type: 'CRYPTOCURRENCY' },
        ]),
      },
      financialInstitution: { findMany: jest.fn().mockResolvedValue([{ name: 'Kraken' }]) },
      assetListing: { findMany: jest.fn().mockResolvedValue([]) },
      investmentTrade: {
        findMany: jest.fn().mockResolvedValue([
          {
            account: { id: 'account', name: 'Spot', kind: 'BANK' },
            acquiredInstrument: { id: 'eur', code: 'EUR', type: 'FIAT' },
            acquiredQuantity: '100',
            disposedInstrument: { id: 'eth', code: 'ETH', type: 'CRYPTOCURRENCY' },
            disposedQuantity: '1',
            feeInstrument: null,
            feeQuantity: null,
            feeValue: null,
            executionValue: 10000,
            executedAt: new Date('2026-01-02T12:00:00Z'),
          },
        ]),
      },
    };
    const result = await new InvestmentImportService(
      prisma as never,
      {
        instrumentBalances: jest
          .fn()
          .mockResolvedValue([{ accountId: 'account', instrumentId: 'eur', quantity: '100', instrumentName: 'Euro', instrumentCode: 'EUR' }]),
      } as never,
      {} as never,
    ).preview('user', Buffer.from(csv.replace('BTC,0.01,EUR,100', 'ETH,1,EUR,50').replace('10000,first', '5000,first')));

    expect(result.positions).toEqual([expect.objectContaining({ instrumentCode: 'ETH', quantity: '0', remainingCost: 0, realizedResult: 5000 })]);
  });

  it('adds accepted reconciliation adjustments to the same import transaction', async () => {
    const prisma: Record<string, unknown> = {
      account: { findMany: jest.fn().mockResolvedValue([{ id: 'account', name: 'Spot', kind: 'EXCHANGE', financialInstitution: { name: 'Kraken' } }]) },
      instrument: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'eur', code: 'EUR', type: 'FIAT' },
          { id: 'btc', code: 'BTC', type: 'CRYPTOCURRENCY' },
        ]),
      },
      financialInstitution: { findMany: jest.fn().mockResolvedValue([{ name: 'Kraken' }]) },
      assetListing: { findMany: jest.fn().mockResolvedValue([]) },
      investmentTrade: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn() },
      importBatch: { create: jest.fn().mockResolvedValue({ id: 'batch' }) },
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    };
    const adjustments = { createImportAdjustments: jest.fn().mockResolvedValue(undefined) };
    const service = new InvestmentImportService(
      prisma as never,
      { instrumentBalances: jest.fn().mockResolvedValue([{ accountId: 'account', instrumentId: 'eur', quantity: '100' }]) } as never,
      adjustments as never,
    );

    await service.confirm(
      'user',
      Buffer.from(csv),
      JSON.stringify([
        {
          accountId: 'account',
          instrumentId: 'btc',
          actualQuantity: '0.02',
          cost: 10000,
          effectiveAt: '2026-01-02T12:00:00.000Z',
          reason: 'Verified exchange balance',
        },
      ]),
    );

    expect(adjustments.createImportAdjustments).toHaveBeenCalledWith(
      'user',
      [expect.objectContaining({ accountId: 'account', instrumentId: 'btc', actualQuantity: '0.02' })],
      prisma,
    );
  });
});

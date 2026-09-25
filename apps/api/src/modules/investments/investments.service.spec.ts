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

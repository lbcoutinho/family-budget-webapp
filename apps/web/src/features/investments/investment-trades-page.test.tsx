import { type AccountDto, type BalanceAdjustmentDto, type InstrumentDto, type InvestmentTradeDto, type PositionAdjustmentDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { InvestmentTradesPage } from './investment-trades-page';

import { server } from '@/test/server';

const account: AccountDto = {
  id: 'exchange',
  name: 'Exchange',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const instruments: InstrumentDto[] = [
  { id: 'btc', name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY', displayPrecision: 8, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'eur', name: 'Euro', code: 'EUR', type: 'FIAT', displayPrecision: 2, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' },
];
const trade: InvestmentTradeDto = {
  id: 'trade',
  accountId: account.id,
  accountName: account.name,
  acquiredInstrumentId: 'btc',
  acquiredInstrumentName: 'Bitcoin',
  acquiredInstrumentCode: 'BTC',
  acquiredDisplayPrecision: 8,
  acquiredQuantity: '0.123456789',
  disposedInstrumentId: 'eur',
  disposedInstrumentName: 'Euro',
  disposedInstrumentCode: 'EUR',
  disposedDisplayPrecision: 2,
  disposedQuantity: '1000.123',
  executedAt: '2026-01-01T10:00:00.000Z',
  executionValue: 100012,
  executionPrice: '8101',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  isImported: false,
};
const adjustment: PositionAdjustmentDto = {
  id: 'adjustment',
  accountId: account.id,
  accountName: account.name,
  instrumentId: 'btc',
  instrumentCode: 'BTC',
  displayPrecision: 8,
  quantity: '0.123456789',
  effectiveAt: '2026-01-02T10:00:00.000Z',
  reason: 'Reconciliation',
  createdAt: '2026-01-02T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
};

describe('InvestmentTradesPage', () => {
  it('uses each instrument display precision in operation and adjustment summaries', async () => {
    server.use(
      http.get('/api/investment-trades', () => HttpResponse.json([trade])),
      http.get('/api/accounts', () => HttpResponse.json([account])),
      http.get('/api/instruments', () => HttpResponse.json(instruments)),
      http.get('/api/asset-listings', () => HttpResponse.json([])),
      http.get('/api/position-adjustments', () => HttpResponse.json([adjustment])),
      http.get('/api/balance-adjustments', () => HttpResponse.json([] satisfies BalanceAdjustmentDto[])),
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <InvestmentTradesPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('0,12345678 BTC')).toBeInTheDocument();
    expect(screen.getByText(/Ajuste de posição.*0,12345678 BTC/)).toBeInTheDocument();
    expect(screen.getByText('1.000,12 EUR')).toBeInTheDocument();
  });
});

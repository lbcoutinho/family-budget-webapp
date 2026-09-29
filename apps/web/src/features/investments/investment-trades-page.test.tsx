import { type AccountDto, type BalanceAdjustmentDto, type InstrumentDto, type InvestmentTradeDto, type PositionAdjustmentDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { delay, HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { InvestmentTradesPage } from './investment-trades-page';

import { server } from '@/test/server';

const account: AccountDto = {
  id: 'exchange',
  name: 'Exchange',
  kind: 'EXCHANGE',
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
  it('shows loading until every operation source has loaded', async () => {
    server.use(
      http.get('/api/investment-trades', async () => {
        await delay(100);
        return HttpResponse.json([trade]);
      }),
      http.get('/api/accounts', () => HttpResponse.json([account])),
      http.get('/api/instruments', () => HttpResponse.json(instruments)),
      http.get('/api/asset-listings', () => HttpResponse.json([])),
      http.get('/api/position-adjustments', () => HttpResponse.json([])),
      http.get('/api/balance-adjustments', () => HttpResponse.json([])),
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <InvestmentTradesPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(await screen.findByText('Negociação')).toBeInTheDocument();
  });

  it('shows trades and adjustments in one chronological history with the adjustment reason', async () => {
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

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Ajuste de posição');
    expect(rows[1]).toHaveTextContent('Reconciliation');
    expect(rows[2]).toHaveTextContent('0,12345678 BTC');
  });

  it('shows one empty history state when every operation source is empty', async () => {
    server.use(
      http.get('/api/investment-trades', () => HttpResponse.json([])),
      http.get('/api/accounts', () => HttpResponse.json([account])),
      http.get('/api/instruments', () => HttpResponse.json(instruments)),
      http.get('/api/asset-listings', () => HttpResponse.json([])),
      http.get('/api/position-adjustments', () => HttpResponse.json([])),
      http.get('/api/balance-adjustments', () => HttpResponse.json([])),
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <InvestmentTradesPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nenhuma operação ainda')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows one error state when an operation source cannot load', async () => {
    server.use(
      http.get('/api/investment-trades', () => HttpResponse.json([trade])),
      http.get('/api/accounts', () => HttpResponse.json([account])),
      http.get('/api/instruments', () => HttpResponse.json(instruments)),
      http.get('/api/asset-listings', () => HttpResponse.json([])),
      http.get('/api/position-adjustments', () => new HttpResponse(null, { status: 500 })),
      http.get('/api/balance-adjustments', () => HttpResponse.json([])),
    );

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <InvestmentTradesPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Não foi possível carregar as operações')).toBeInTheDocument();
  });

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

    expect(await screen.findAllByText('0,12345678 BTC')).toHaveLength(2);
    expect(screen.getByText('Ajuste de posição')).toBeInTheDocument();
    expect(screen.getByText('1.000,12 EUR')).toBeInTheDocument();
  });
});

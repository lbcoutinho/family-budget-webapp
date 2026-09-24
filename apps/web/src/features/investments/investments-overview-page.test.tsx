import { type AccountDto, type InvestmentPositionDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { InvestmentsOverviewPage } from './investments-overview-page';

import { server } from '@/test/server';

const positions: InvestmentPositionDto[] = [
  {
    accountId: null,
    accountName: null,
    instrumentId: 'vwce',
    instrumentName: 'World ETF',
    instrumentCode: 'VWCE',
    instrumentType: 'ETF',
    displayPrecision: 4,
    quantity: '15',
    remainingCost: 275000,
    weightedAverageCost: '183.333333333333',
    realizedResult: 150000,
    quotePrice: '200',
    quoteInstrumentCode: 'EUR',
    quoteMarketDate: '2026-09-24',
    quoteStatus: 'MANUAL',
    currentValue: 300000,
    unrealizedResult: 25000,
  },
  {
    accountId: 'broker',
    accountName: 'Broker',
    instrumentId: 'vwce',
    instrumentName: 'World ETF',
    instrumentCode: 'VWCE',
    instrumentType: 'ETF',
    displayPrecision: 4,
    quantity: '15',
    remainingCost: 275000,
    weightedAverageCost: '183.333333333333',
    realizedResult: 150000,
    quotePrice: '200',
    quoteInstrumentCode: 'EUR',
    quoteMarketDate: '2026-09-24',
    quoteStatus: 'MANUAL',
    currentValue: 300000,
    unrealizedResult: 25000,
  },
];
const accounts: AccountDto[] = [
  {
    id: 'broker',
    name: 'Broker',
    initialBalance: 0,
    isActive: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <InvestmentsOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvestmentsOverviewPage', () => {
  it('shows a consolidated position followed by its custody account', async () => {
    server.use(
      http.get('/api/investment-positions', () => HttpResponse.json(positions)),
      http.get('/api/accounts', () => HttpResponse.json(accounts)),
      http.get('/api/asset-listings', () => HttpResponse.json([])),
    );

    renderPage();

    expect(await screen.findByText('World ETF')).toBeInTheDocument();
    expect(screen.getByText('Consolidado')).toBeInTheDocument();
    expect(screen.getByText('Broker')).toBeInTheDocument();
    expect(screen.getAllByText('2.750,00 €')).toHaveLength(3);
    expect(screen.getAllByText('1.500,00 €')).toHaveLength(3);
    expect(screen.getAllByText('3.000,00 €')).toHaveLength(3);
  });
});

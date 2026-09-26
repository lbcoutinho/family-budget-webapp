import { type InvestmentFlowDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { InvestmentFlowPage } from './investment-flow-page';

import { server } from '@/test/server';

const flow = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  investmentPurchaseAmount: index === 0 ? 100000 : 0,
  netSales: 0,
  netInvestmentFlow: index === 0 ? 100000 : 0,
  tradeFees: 1000,
  realizedResult: 0,
  trades:
    index === 0
      ? [
          {
            id: 'btc',
            accountId: 'exchange',
            accountName: 'Exchange',
            acquiredInstrumentId: 'btc',
            acquiredInstrumentName: 'Bitcoin',
            acquiredInstrumentCode: 'BTC',
            acquiredDisplayPrecision: 8,
            acquiredQuantity: '0.01',
            disposedInstrumentId: 'eur',
            disposedInstrumentName: 'Euro',
            disposedInstrumentCode: 'EUR',
            disposedDisplayPrecision: 2,
            disposedQuantity: '1000',
            feeInstrumentId: null,
            feeInstrumentName: null,
            feeInstrumentCode: null,
            feeDisplayPrecision: null,
            feeQuantity: null,
            feeValue: null,
            assetListingId: null,
            assetListing: null,
            executedAt: '2026-01-01T10:00:00.000Z',
            executionValue: 100000,
            executionPrice: '100000',
            notes: null,
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
        ]
      : [],
  fundingTransfers: [],
})) as InvestmentFlowDto[];

describe('InvestmentFlowPage', () => {
  it('shows the selected month operations below the annual table', async () => {
    server.use(http.get('/api/investment-flows', () => HttpResponse.json(flow)));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <InvestmentFlowPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'janeiro' }));

    expect(screen.getByText('Operações de janeiro de 2026')).toBeInTheDocument();
    expect(screen.getByText(/EUR.*BTC/)).toBeInTheDocument();
  });
});

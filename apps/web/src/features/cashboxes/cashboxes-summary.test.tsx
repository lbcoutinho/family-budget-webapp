import { type CashboxBalanceDto, type TransactionListDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { CashboxesSummary } from './cashboxes-summary';

import { formatMonthName } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { server } from '@/test/server';

const BALANCES: CashboxBalanceDto[] = [
  { cashboxId: 'c1', name: 'Férias 2027', isActive: true, targetAmount: null, balance: 2000 },
  { cashboxId: 'c2', name: 'Reforma', isActive: true, targetAmount: null, balance: 1500 },
  { cashboxId: 'c3', name: 'Emergência', isActive: false, targetAmount: null, balance: 999 },
];

function transactionList(overrides: Partial<TransactionListDto> = {}): TransactionListDto {
  return {
    items: [],
    total: 0,
    incomeTotal: 0,
    expenseTotal: 0,
    cashboxInTotal: 0,
    cashboxOutTotal: 0,
    nextCursor: null,
    ...overrides,
  };
}

function renderSummary(month = new Date(2026, 6, 1), activeCount = 2) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <CashboxesSummary month={month} activeCount={activeCount} />
    </QueryClientProvider>,
  );
}

describe('CashboxesSummary', () => {
  it('renders all four cards once both queries resolve, summing only active balances', async () => {
    server.use(
      http.get('/api/cashboxes/balances', () => HttpResponse.json(BALANCES)),
      http.get('/api/transactions', () => HttpResponse.json(transactionList({ cashboxInTotal: 60000, cashboxOutTotal: 20000 }))),
    );

    renderSummary();

    expect(screen.getByText('Caixinhas ativas')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(formatCents(60000, { sign: true }))).toBeInTheDocument();
    });
    expect(screen.getByText(formatCents(-20000, { sign: true }))).toBeInTheDocument();
    // Only the two active balances (2000 + 1500) count toward the total — the inactive one (999) is excluded.
    expect(screen.getByText(formatCents(3500))).toBeInTheDocument();
  });

  it('shows the month name in both the deposited and withdrawn labels', async () => {
    server.use(
      http.get('/api/cashboxes/balances', () => HttpResponse.json(BALANCES)),
      http.get('/api/transactions', () => HttpResponse.json(transactionList())),
    );

    const month = new Date(2026, 6, 1);
    renderSummary(month);
    const monthName = formatMonthName(month);

    await waitFor(() => {
      expect(screen.getByText(`Depositado em ${monthName}`)).toBeInTheDocument();
    });
    expect(screen.getByText(`Resgatado em ${monthName}`)).toBeInTheDocument();
  });

  it('shows skeletons while the queries are pending', () => {
    server.use(
      http.get('/api/cashboxes/balances', async () => {
        await new Promise(() => undefined);

        return HttpResponse.json(BALANCES);
      }),
      http.get('/api/transactions', async () => {
        await new Promise(() => undefined);

        return HttpResponse.json(transactionList());
      }),
    );

    const { container } = renderSummary();

    // The active-count card is not backed by a query, so it renders straight away...
    expect(screen.getByText('Caixinhas ativas')).toBeInTheDocument();
    // ...while the other three sit behind a skeleton until both queries settle.
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });
});

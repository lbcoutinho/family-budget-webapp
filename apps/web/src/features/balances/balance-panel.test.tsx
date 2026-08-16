import { type AccountBalanceDto, type CashboxBalanceDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { BalancePanel } from './balance-panel';

import { formatCents } from '@/lib/money';
import { server } from '@/test/server';

const ACCOUNT_BALANCES: AccountBalanceDto[] = [
  { accountId: 'a1', name: 'Millennium', isActive: true, initialBalance: 0, balance: 348215 },
  { accountId: 'a2', name: 'Revolut', isActive: true, initialBalance: 0, balance: 41290 },
  { accountId: 'a3', name: 'Old bank', isActive: false, initialBalance: 0, balance: 1000 },
];

const CASHBOX_BALANCES: CashboxBalanceDto[] = [
  { cashboxId: 'c1', name: 'Férias 2027', isActive: true, targetAmount: null, balance: 200000 },
  { cashboxId: 'c2', name: 'Reforma', isActive: true, targetAmount: null, balance: 215000 },
  { cashboxId: 'c3', name: 'Emergência', isActive: false, targetAmount: null, balance: 99999 },
];

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <BalancePanel />
    </QueryClientProvider>,
  );
}

describe('BalancePanel', () => {
  it('shows a skeleton while either query is pending', () => {
    server.use(
      http.get('/api/accounts/balances', () => HttpResponse.json(ACCOUNT_BALANCES)),
      http.get('/api/cashboxes/balances', async () => {
        await new Promise(() => undefined);

        return HttpResponse.json(CASHBOX_BALANCES);
      }),
    );

    const { container } = renderPanel();

    expect(screen.queryByText('Millennium')).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(8);
  });

  it('renders one card per active account, an aggregated cashbox card and the consolidated total, excluding inactive entries', async () => {
    server.use(
      http.get('/api/accounts/balances', () => HttpResponse.json(ACCOUNT_BALANCES)),
      http.get('/api/cashboxes/balances', () => HttpResponse.json(CASHBOX_BALANCES)),
    );

    renderPanel();

    expect(await screen.findByText('Millennium')).toBeInTheDocument();
    expect(screen.getByText(formatCents(348215))).toBeInTheDocument();
    expect(screen.getByText('Revolut')).toBeInTheDocument();
    expect(screen.getByText(formatCents(41290))).toBeInTheDocument();
    expect(screen.queryByText('Old bank')).not.toBeInTheDocument();

    // Aggregated cashboxes card: only the two active balances (2000,00 + 2150,00) count.
    expect(screen.getByText('Caixinhas')).toBeInTheDocument();
    expect(screen.getByText(formatCents(415000))).toBeInTheDocument();

    // Consolidated total: active accounts (3.482,15 + 412,90) plus active cashboxes (4.150,00).
    expect(screen.getByText('Total consolidado')).toBeInTheDocument();
    expect(screen.getByText(formatCents(348215 + 41290 + 415000))).toBeInTheDocument();
  });

  it('shows an em dash on the affected cards when a balances query fails, without a per-account card', async () => {
    server.use(
      http.get('/api/accounts/balances', () => HttpResponse.json(ACCOUNT_BALANCES)),
      http.get('/api/cashboxes/balances', () => new HttpResponse(null, { status: 500 })),
    );

    renderPanel();

    expect(await screen.findByText('Millennium')).toBeInTheDocument();
    expect(screen.getByText('Caixinhas').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('Total consolidado').nextSibling).toHaveTextContent('—');
  });
});

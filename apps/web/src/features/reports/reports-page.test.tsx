import { type BalancesReportDto, type MonthlyReportDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { routes } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthContext } from '@/features/auth/auth-context';
import { server } from '@/test/server';

const USER = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' as const };

const EMPTY_MONTHLY: MonthlyReportDto = {
  year: 2026,
  month: 7,
  incomeTotal: 0,
  expenseTotal: 0,
  balance: 0,
  categories: [],
  cashboxes: { items: [], depositsTotal: 0, withdrawalsTotal: 0, balance: 0 },
};

const MONTHLY_REPORT: MonthlyReportDto = {
  ...EMPTY_MONTHLY,
  incomeTotal: 320_000,
  expenseTotal: 133_000,
  balance: 187_000,
  categories: [
    {
      categoryId: 'cat-housing',
      name: 'Moradia',
      color: '#1f6f54',
      kind: 'EXPENSE',
      amount: 115_000,
      percentage: 86.5,
      rollingAverage: 102_800,
      count: 4,
      subcategories: [
        { subcategoryId: 'sub-rent', name: 'Renda', amount: 95_000, percentage: 82.6, rollingAverage: 95_000, count: 1 },
        { subcategoryId: 'sub-utilities', name: 'Água, luz e gás', amount: 20_000, percentage: 17.4, rollingAverage: 15_600, count: 3 },
      ],
    },
    {
      categoryId: 'cat-leisure',
      name: 'Lazer',
      color: '#7a45b5',
      kind: 'EXPENSE',
      amount: 18_000,
      percentage: 13.5,
      rollingAverage: 21_400,
      count: 4,
      subcategories: [],
    },
    {
      categoryId: 'cat-work',
      name: 'Trabalho',
      color: '#6f3d24',
      kind: 'INCOME',
      amount: 320_000,
      percentage: 100,
      rollingAverage: 320_000,
      count: 1,
      subcategories: [],
    },
  ],
  cashboxes: {
    items: [{ cashboxId: 'cb-1', name: 'Reserva', deposits: 60_000, withdrawals: 0, balance: 60_000 }],
    depositsTotal: 60_000,
    withdrawalsTotal: 0,
    balance: 60_000,
  },
};

const BALANCES_REPORT: BalancesReportDto = {
  year: 2026,
  snapshot: {
    cutoffDate: '2026-05-15',
    accounts: [{ accountId: 'account-1', name: 'Current', isActive: true, balance: 120_000 }],
    cashboxes: [{ cashboxId: 'cashbox-1', name: 'Reserve', isActive: true, balance: 30_000 }],
    totalAccounts: 120_000,
    totalCashboxes: 30_000,
    totalNetWorth: 150_000,
  },
  currentAccountingClose: 170_000,
  futureDatedTransactions: 20_000,
  evolution: {
    hasSufficientHistory: true,
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      accounts: 100_000 + index * 1_000,
      cashboxes: 20_000 + index * 500,
      netWorth: 120_000 + index * 1_500,
      inProgress: index === 4,
    })),
  },
};

/** The real route table, so cell/row navigation is exercised against the routes the application
 * actually ships — including `ProtectedRoute`/`AppLayout` — rather than a hand-rolled copy. */
function renderReports(initialEntry = '/reports?year=2026&month=7') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  return {
    user: userEvent.setup(),
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthContext value={{ user: USER, logout: () => Promise.resolve() }}>
            <RouterProvider router={router} />
          </AuthContext>
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('ReportsPage — monthly view', () => {
  beforeEach(() => {
    server.use(http.get('/api/reports/monthly', () => HttpResponse.json(MONTHLY_REPORT)));
  });

  it('shows expense and income as separate tables, each with its own amount, percentage and against-the-average colouring', async () => {
    renderReports();

    const expenseTable = (await screen.findByRole('heading', { name: 'Despesas por categoria' })).closest('section')!;
    expect(within(expenseTable).getByText('− 1.150,00 €')).toBeInTheDocument();
    expect(within(expenseTable).getByText('86,5%')).toBeInTheDocument();
    // Moradia (1150) is above its average (1028) — an expense above average reads bad (red), the
    // one reversal in the app: +11,9%.
    expect(within(expenseTable).getByText('+11,9%')).toBeInTheDocument();
    // Lazer (180) is below its average (214) — good (green): −15,9%.
    expect(within(expenseTable).getByText('−15,9%')).toBeInTheDocument();

    const incomeTable = screen.getByRole('heading', { name: 'Receitas por categoria' }).closest('section')!;
    // Row and footer total coincide (the only income category), so both occurrences are expected.
    expect(within(incomeTable).getAllByText('+ 3.200,00 €')).toHaveLength(2);
    // Trabalho matches its own average exactly — flat.
    expect(within(incomeTable).getByText('+0,0%')).toBeInTheDocument();
  });

  it('keeps subcategories collapsed until the expander is clicked', async () => {
    const { user } = renderReports();

    await screen.findByText('Moradia');
    expect(screen.queryByText('Renda')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver subcategorias de Moradia' }));

    expect(screen.getByText('Renda')).toBeInTheDocument();
    expect(screen.getByText('Água, luz e gás')).toBeInTheDocument();
  });

  it('does not offer an expander for a category with no real subcategory breakdown', async () => {
    renderReports();

    await screen.findByText('Lazer');
    expect(screen.queryByRole('button', { name: 'Ver subcategorias de Lazer' })).not.toBeInTheDocument();
  });

  it('shows the cashbox block expanded by default, informational and outside the percentages', async () => {
    renderReports();

    await screen.findByText('Reserva');
    // The item's own deposit cell and the footer's deposits total coincide (only one cashbox).
    expect(screen.getAllByText('600,00 €')).toHaveLength(2);
  });

  it('renders an empty state for a period with no activity, not a broken table', async () => {
    server.use(http.get('/api/reports/monthly', () => HttpResponse.json(EMPTY_MONTHLY)));

    renderReports();

    expect(await screen.findByText('Nenhum movimento no período')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('clicking a category row opens the same month filtered by that category', async () => {
    const requests: URL[] = [];
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.get('/api/cashboxes', () => HttpResponse.json([])),
      http.get('/api/accounts/balances', () => HttpResponse.json([])),
      http.get('/api/cashboxes/balances', () => HttpResponse.json([])),
      http.get('/api/transactions', ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ items: [], total: 0, incomeTotal: 0, expenseTotal: 0, cashboxInTotal: 0, cashboxOutTotal: 0, nextCursor: null });
      }),
    );
    const { user, router } = renderReports();

    await user.click(await screen.findByRole('button', { name: 'Moradia' }));

    expect(router.state.location.pathname).toBe('/month/2026/07');
    expect(router.state.location.search).toBe('?categoryId=cat-housing');
    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(requests.some((url) => url.searchParams.get('categoryId') === 'cat-housing')).toBe(true);
  });
});

describe('ReportsPage — segmented control and URL state', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/reports/monthly', () => HttpResponse.json(EMPTY_MONTHLY)),
      http.get('/api/reports/yearly', () =>
        HttpResponse.json({
          year: 2026,
          averageWindow: { from: '2025-08-01', to: '2026-07-01' },
          months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, income: 0, expense: 0, balance: 0 })),
          categories: [],
          totals: { income: 0, expense: 0, balance: 0 },
        }),
      ),
    );
  });

  it('switches to the yearly view and reflects it in the URL', async () => {
    const { user, router } = renderReports();

    await screen.findByRole('tab', { name: 'Mensal' });
    await user.click(screen.getByRole('tab', { name: 'Anual' }));

    expect(router.state.location.search).toContain('view=yearly');
    expect(screen.getByRole('tab', { name: 'Anual', selected: true })).toBeInTheDocument();
  });

  it('restores the yearly view from a shared URL', async () => {
    renderReports('/reports?view=yearly&year=2025');

    expect(await screen.findByRole('tab', { name: 'Anual', selected: true })).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
  });
});

describe('ReportsPage — balances view', () => {
  it('shows the dated effective snapshot, its allocation, comparison, and in-progress yearly evolution', async () => {
    server.use(http.get('/api/reports/balances', () => HttpResponse.json(BALANCES_REPORT)));

    renderReports('/reports?view=balances&year=2026');

    expect(await screen.findByRole('tab', { name: 'Saldos', selected: true })).toBeInTheDocument();
    expect(await screen.findByText('Posição em 15/05/2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Total em contas')).toHaveTextContent('Current');
    expect(screen.getByLabelText('Total em caixinhas')).toHaveTextContent('Reserve');
    expect(screen.getByRole('img', { name: 'Contas 80%, caixinhas 20%' })).toBeInTheDocument();
    expect(screen.getByText('Fechamento contábil atual')).toBeInTheDocument();
    expect(screen.getByText('mai em andamento')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evolução em 2026' })).toBeInTheDocument();
    expect(screen.getByLabelText('Legenda do gráfico')).toHaveTextContent('Total em caixinhas');
  });

  it('keeps the snapshot when the selected year has insufficient history', async () => {
    server.use(
      http.get('/api/reports/balances', () =>
        HttpResponse.json({ ...BALANCES_REPORT, year: 2020, evolution: { hasSufficientHistory: false, months: BALANCES_REPORT.evolution.months } }),
      ),
    );

    renderReports('/reports?view=balances&year=2020');

    expect(await screen.findByText('Histórico insuficiente em 2020')).toBeInTheDocument();
    expect(screen.getByText('Posição em 15/05/2026')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Evolução em 2020' })).not.toBeInTheDocument();
  });
});

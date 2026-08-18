import { type MonthlyReportDto, type YearlyReportDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthContext } from '@/features/auth/auth-context';
import { server } from '@/test/server';

const USER = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' as const };

const MONTHLY_REPORT: MonthlyReportDto = {
  year: 2026,
  month: 7,
  incomeTotal: 0,
  expenseTotal: 133_000,
  balance: -133_000,
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
      subcategories: [],
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
  ],
  cashboxes: { items: [], depositsTotal: 0, withdrawalsTotal: 0, balance: 0 },
};

const EMPTY_MONTHLY: MonthlyReportDto = { ...MONTHLY_REPORT, expenseTotal: 0, categories: [] };

const MONTHS = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, income: 0, expense: 0, balance: 0 }));

const YEARLY_REPORT: YearlyReportDto = {
  year: 2026,
  averageWindow: { from: '2025-08-01', to: '2026-07-01' },
  months: MONTHS.map((month) => (month.month <= 7 ? { ...month, income: 320_000, expense: 133_000, balance: 187_000 } : month)),
  categories: [
    {
      categoryId: 'cat-housing',
      name: 'Moradia',
      color: '#1f6f54',
      kind: 'EXPENSE',
      monthly: [115_000, 115_000, 115_000, 115_000, 115_000, 115_000, 115_000, 0, 0, 0, 0, 0],
      total: 805_000,
      monthlyAverage: 115_000,
      subcategories: [],
    },
    {
      categoryId: 'cat-leisure',
      name: 'Lazer',
      color: '#7a45b5',
      kind: 'EXPENSE',
      monthly: [18_000, 18_000, 18_000, 18_000, 18_000, 18_000, 18_000, 0, 0, 0, 0, 0],
      total: 126_000,
      monthlyAverage: 18_000,
      subcategories: [],
    },
  ],
  totals: { income: 2_240_000, expense: 931_000, balance: 1_309_000 },
};

const EMPTY_YEARLY: YearlyReportDto = { ...YEARLY_REPORT, months: MONTHS, categories: [], totals: { income: 0, expense: 0, balance: 0 } };

function renderReports(initialEntry = '/reports?view=charts&year=2026&month=7') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  return {
    user: userEvent.setup(),
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

describe('ReportsPage — charts view', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 15));
    server.use(
      http.get('/api/reports/monthly', () => HttpResponse.json(MONTHLY_REPORT)),
      http.get('/api/reports/yearly', () => HttpResponse.json(YEARLY_REPORT)),
    );
  });

  afterEach(() => vi.useRealTimers());

  it('renders the donut, stacked bar and income/expense charts from the monthly and yearly reports', async () => {
    renderReports();

    expect(await screen.findByRole('heading', { name: /Distribuição de Julho de 2026/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026, mês a mês' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Receita × despesa' })).toBeInTheDocument();

    // Both expense categories are drawn — nothing collapses into "Outras".
    const donut = screen.getByRole('heading', { name: /Distribuição de Julho de 2026/ }).closest('section')!;
    expect(within(donut).getAllByText('Moradia').length).toBeGreaterThan(0);
    expect(within(donut).getAllByText('Lazer').length).toBeGreaterThan(0);
  });

  it('reads the untouched donut total and percentages straight from the API, not recomputed from the category amounts', async () => {
    // expenseTotal deliberately does not equal the sum of the two categories' amounts (133_000):
    // if the centre total were recomputed client-side it would read 1.330,00 €, not this value.
    server.use(http.get('/api/reports/monthly', () => HttpResponse.json({ ...MONTHLY_REPORT, expenseTotal: 140_000 })));

    renderReports();

    const donut = (await screen.findByRole('heading', { name: /Distribuição de Julho de 2026/ })).closest('section')!;
    expect(within(donut).getByTestId('donut-total')).toHaveTextContent('1.400,00 €');
    // Moradia's percentage (86.5) comes straight from the fixture, not (115_000 / 140_000) * 100.
    expect(within(donut).getByText('86,5%')).toBeInTheDocument();
  });

  it('hides a category everywhere when its legend entry is toggled off, and recalculates the donut total', async () => {
    const { user } = renderReports();

    const donut = (await screen.findByRole('heading', { name: /Distribuição de Julho de 2026/ })).closest('section')!;
    expect(within(donut).getByTestId('donut-total')).toHaveTextContent('1.330,00 €');

    const toggle = within(donut).getByRole('button', { name: 'Ligar ou desligar Moradia' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Only Lazer (180,00 €) remains — the centre total no longer counts Moradia.
    expect(within(donut).getByTestId('donut-total')).toHaveTextContent('180,00 €');
  });

  it('shows an empty state instead of an empty chart frame when a period has no data', async () => {
    server.use(
      http.get('/api/reports/monthly', () => HttpResponse.json(EMPTY_MONTHLY)),
      http.get('/api/reports/yearly', () => HttpResponse.json(EMPTY_YEARLY)),
    );

    renderReports();

    expect(await screen.findAllByText('Nenhum movimento no período')).not.toHaveLength(0);
  });
});

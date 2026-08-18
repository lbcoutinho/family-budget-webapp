import { type YearlyReportDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportsPage } from './reports-page';

import { TooltipProvider } from '@/components/ui/tooltip';
import { MonthPage } from '@/features/transactions/month-page';
import { server } from '@/test/server';

const MONTHS = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, income: 0, expense: 0, balance: 0 }));

const YEARLY_REPORT: YearlyReportDto = {
  year: 2026,
  averageWindow: { from: '2025-08-01', to: '2026-07-01' },
  months: MONTHS.map((month) => (month.month <= 7 ? { ...month, expense: 100_000 } : month)),
  categories: [
    {
      categoryId: 'cat-housing',
      name: 'Moradia',
      color: '#1f6f54',
      kind: 'EXPENSE',
      // Jan-Jul filled with distinct values (so a query for July's alone is unambiguous),
      // Aug-Dec are future (test freezes "now" at July 2026).
      monthly: [112_000, 112_000, 114_500, 113_000, 114_000, 114_800, 115_000, 0, 0, 0, 0, 0],
      total: 795_300,
      monthlyAverage: 113_600,
      subcategories: [
        { subcategoryId: 'sub-rent', name: 'Aluguel', monthly: [95_000, 95_000, 95_000, 95_000, 95_000, 95_000, 95_000, 0, 0, 0, 0, 0], total: 665_000 },
      ],
    },
  ],
  totals: { income: 0, expense: 796_500, balance: -796_500 },
  comparison: {
    year: 2025,
    months: MONTHS,
    categories: [{ categoryId: 'cat-housing', name: 'Moradia', color: '#1f6f54', kind: 'EXPENSE', monthly: new Array<number>(12).fill(0), total: 771_000 }],
    totals: { income: 0, expense: 771_000, balance: -771_000 },
  },
};

function renderReports(initialEntry = '/reports?view=yearly&year=2026') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/reports', element: <ReportsPage /> },
      { path: '/month/:year/:month', element: <MonthPage /> },
    ],
    { initialEntries: [initialEntry] },
  );

  return {
    user: userEvent.setup(),
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('ReportsPage — yearly view', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 15)); // "today" is July 2026, matching the fixture above
    server.use(
      http.get('/api/reports/yearly', ({ request }) => {
        const compare = new URL(request.url).searchParams.get('compare') === 'true';
        const { comparison: _comparison, ...rest } = YEARLY_REPORT;
        return HttpResponse.json(compare ? YEARLY_REPORT : rest);
      }),
    );
  });

  afterEach(() => vi.useRealTimers());

  it('renders twelve month columns, whole euros, with future months shown as —', async () => {
    renderReports();

    const table = (await screen.findByRole('heading', { name: 'Despesas por categoria' })).closest('section')!;
    for (const abbreviation of ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']) {
      expect(within(table).getByText(abbreviation)).toBeInTheDocument();
    }
    // July (index 6, the "current" month) has real movement.
    expect(within(table).getByText('1.150 €')).toBeInTheDocument();
    // Every month from August (index 7) on is future and reads as —, not 0.
    const dashes = within(table).getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it('heads the average column "Média 12 meses" — never just "Média" — with a tooltip stating the window and divisor', async () => {
    const { user } = renderReports();

    const header = await screen.findByRole('columnheader', { name: 'Média 12 meses' });
    expect(header).toBeInTheDocument();
    expect(screen.queryByText(/^Média$/)).not.toBeInTheDocument();

    await user.hover(within(header).getByText('Média 12 meses'));
    expect(await screen.findByText(/dividida só pelos meses que tiveram movimento/)).toBeInTheDocument();
  });

  it('keeps the category column frozen (sticky) so the matrix can scroll horizontally', async () => {
    renderReports();

    const categoryHeader = await screen.findByRole('columnheader', { name: 'Categoria' });
    expect(categoryHeader.className).toContain('sticky');
  });

  it('reveals subcategory rows, each with their own twelve-month series, only once expanded', async () => {
    const { user } = renderReports();

    await screen.findByText('Moradia');
    expect(screen.queryByText('Aluguel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver subcategorias de Moradia' }));

    expect(screen.getByText('Aluguel')).toBeInTheDocument();
  });

  it('shows the prior-year comparison inside the cell, one row per category, once the compare switch is on', async () => {
    const { user } = renderReports();

    await screen.findByText('Moradia');
    expect(screen.queryByText(/2025:/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Comparar com 2025' }));

    expect(await screen.findByText(/2025:/)).toBeInTheDocument();
    // Still exactly one row for Moradia — the comparison never gets a row of its own.
    expect(screen.getAllByText('Moradia')).toHaveLength(1);
  });

  it('clicking a cell opens that month filtered by the category', async () => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.get('/api/cashboxes', () => HttpResponse.json([])),
      http.get('/api/accounts/balances', () => HttpResponse.json([])),
      http.get('/api/cashboxes/balances', () => HttpResponse.json([])),
      http.get('/api/transactions', () =>
        HttpResponse.json({ items: [], total: 0, incomeTotal: 0, expenseTotal: 0, cashboxInTotal: 0, cashboxOutTotal: 0, nextCursor: null }),
      ),
    );
    const { user, router } = renderReports();

    await screen.findByText('Moradia');
    await user.click(screen.getByText('1.150 €'));

    expect(router.state.location.pathname).toBe('/month/2026/07');
    expect(router.state.location.search).toBe('?categoryId=cat-housing');
  });
});

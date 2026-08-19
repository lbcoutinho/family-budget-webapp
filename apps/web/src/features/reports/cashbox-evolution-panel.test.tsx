import { type CashboxesReportCashboxDto, type CashboxesReportDto, type MonthlyReportDto, type YearlyReportDto } from '@family-budget/api-client';
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

const EMPTY_MONTHLY: MonthlyReportDto = {
  year: 2026,
  month: 7,
  incomeTotal: 0,
  expenseTotal: 0,
  balance: 0,
  categories: [],
  cashboxes: { items: [], depositsTotal: 0, withdrawalsTotal: 0, balance: 0 },
};

const MONTHS = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, income: 0, expense: 0, balance: 0 }));
const EMPTY_YEARLY: YearlyReportDto = {
  year: 2026,
  averageWindow: { from: '2025-08-01', to: '2026-07-01' },
  months: MONTHS,
  categories: [],
  totals: { income: 0, expense: 0, balance: 0 },
};

const zeroMonths = (): CashboxesReportCashboxDto['months'] =>
  Array.from({ length: 12 }, (_, index) => ({ month: index + 1, deposits: 0, withdrawals: 0, balance: 0 }));

const RESERVA: CashboxesReportCashboxDto = {
  cashboxId: 'cx-reserva',
  name: 'Reserva',
  isActive: true,
  targetAmount: 1_000_000,
  openingBalance: 200_000,
  deposits: 420_000,
  withdrawals: 0,
  transfersIn: 0,
  transfersOut: 0,
  closingBalance: 620_000,
  months: zeroMonths().map((m, i) => (i === 6 ? { ...m, deposits: 420_000, balance: 620_000 } : { ...m, balance: 200_000 })),
};

const DELETED: CashboxesReportCashboxDto = {
  cashboxId: null,
  name: 'Fundo de obras',
  isActive: null,
  targetAmount: null,
  openingBalance: 0,
  deposits: 90_000,
  withdrawals: 90_000,
  transfersIn: 0,
  transfersOut: 0,
  closingBalance: 0,
  months: zeroMonths().map((m, i) =>
    i <= 3 ? { ...m, deposits: i === 3 ? 90_000 : 0, withdrawals: i === 3 ? 90_000 : 0, balance: 0 } : { ...m, balance: null },
  ),
};

const CASHBOXES_REPORT: CashboxesReportDto = { year: 2026, cashboxes: [RESERVA, DELETED] };
const EMPTY_CASHBOXES: CashboxesReportDto = { year: 2026, cashboxes: [] };

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

describe('CashboxEvolutionPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 15));
    server.use(
      http.get('/api/reports/monthly', () => HttpResponse.json(EMPTY_MONTHLY)),
      http.get('/api/reports/yearly', () => HttpResponse.json(EMPTY_YEARLY)),
    );
  });

  afterEach(() => vi.useRealTimers());

  it('renders one row per cashbox with deposits, withdrawals, closing balance and target progress', async () => {
    server.use(http.get('/api/reports/cashboxes', () => HttpResponse.json(CASHBOXES_REPORT)));

    renderReports();

    const panel = (await screen.findByRole('heading', { name: 'Caixinhas em 2026' })).closest('section')!;
    expect(within(panel).getByText('fora das despesas')).toBeInTheDocument();

    const table = within(panel).getByRole('table');
    const reservaRow = within(table).getByText('Reserva').closest('tr')!;
    expect(within(reservaRow).getByText('4.200,00 €')).toBeInTheDocument(); // deposits
    expect(within(reservaRow).getByText('6.200,00 €')).toBeInTheDocument(); // closing balance
    expect(within(reservaRow).getByText('62% de 10.000,00 €')).toBeInTheDocument(); // 620_000 / 1_000_000
  });

  it("shows a deleted cashbox's row named from its label snapshot, not clickable, with no target", async () => {
    server.use(http.get('/api/reports/cashboxes', () => HttpResponse.json(CASHBOXES_REPORT)));

    renderReports();

    const panel = (await screen.findByRole('heading', { name: 'Caixinhas em 2026' })).closest('section')!;
    const table = within(panel).getByRole('table');
    const deletedRow = within(table).getByText('Fundo de obras').closest('tr')!;

    expect(within(deletedRow).queryByRole('button')).not.toBeInTheDocument();
    expect(within(deletedRow).getByText('apagada')).toBeInTheDocument();
    expect(within(deletedRow).getByText('sem meta')).toBeInTheDocument();
  });

  it('navigates to /cashboxes when a live cashbox row is clicked', async () => {
    server.use(
      http.get('/api/reports/cashboxes', () => HttpResponse.json(CASHBOXES_REPORT)),
      http.get('/api/cashboxes', () => HttpResponse.json([])),
      http.get('/api/cashboxes/balances', () => HttpResponse.json([])),
    );

    const { user } = renderReports();

    const panel = (await screen.findByRole('heading', { name: 'Caixinhas em 2026' })).closest('section')!;
    const table = within(panel).getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Reserva' }));

    expect(await screen.findByRole('heading', { name: 'Caixinhas' })).toBeInTheDocument();
  });

  it('shows an empty state when the year has no cashbox activity', async () => {
    server.use(http.get('/api/reports/cashboxes', () => HttpResponse.json(EMPTY_CASHBOXES)));

    renderReports();

    const panel = (await screen.findByRole('heading', { name: 'Caixinhas em 2026' })).closest('section')!;
    expect(within(panel).getByText('Nenhum movimento no período')).toBeInTheDocument();
  });
});

import { type YearlyReportDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthContext } from '@/features/auth/auth-context';
import { server } from '@/test/server';

const USER = { id: 'u1', email: 'luis@example.com', name: 'Luís', locale: 'pt-BR' as const };
const CATEGORY = {
  id: 'c1',
  parentId: null,
  name: 'Moradia',
  kind: 'EXPENSE',
  color: '#1f6f54',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const NEW_CATEGORY = { ...CATEGORY, id: 'c2', name: 'Lazer' };
const BUDGET = {
  id: 'b1',
  year: 2026,
  quarter: 3,
  estimatedQuarterlyIncome: 1_050_000,
  note: 'Bônus em setembro',
  allocations: [
    {
      categoryId: CATEGORY.id,
      category: { id: CATEGORY.id, name: CATEGORY.name, color: CATEGORY.color, isActive: true },
      targetPercentage: 20,
      suggestedQuarterlyTarget: 210_000,
      suggestedMonthlyTarget: 70_000,
      adjustedMonthlyAmount: 10_000,
      effectiveQuarterlyTarget: 30_000,
      effectivePercentage: 2.86,
      note: 'Valor manual',
    },
  ],
  effectiveQuarterlyExpenseTotal: 30_000,
  plannedFinancialGoalsAvailability: 1_020_000,
  effectiveExpensePercentage: 2.86,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const YEARLY_REPORT: YearlyReportDto = {
  year: 2026,
  averageWindow: { from: '2025-10-01', to: '2026-09-01' },
  months: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    income: index === 6 ? 300_000 : index === 7 ? 400_000 : index === 8 ? 372_000 : 0,
    expense: index === 6 ? 200_000 : index === 7 ? 300_000 : index === 8 ? 387_800 : 0,
    balance: 0,
  })),
  categories: [
    {
      categoryId: 'salary',
      name: 'Salário',
      color: '#1f6f54',
      kind: 'INCOME',
      monthly: [0, 0, 0, 0, 0, 0, 300_000, 400_000, 300_000, 0, 0, 0],
      total: 1_000_000,
      monthlyAverage: 0,
      subcategories: [],
    },
    {
      categoryId: 'bonus',
      name: 'Bônus',
      color: '#1f5aa8',
      kind: 'INCOME',
      monthly: [0, 0, 0, 0, 0, 0, 0, 0, 72_000, 0, 0, 0],
      total: 72_000,
      monthlyAverage: 0,
      subcategories: [],
    },
    {
      categoryId: 'expense',
      name: 'Moradia',
      color: '#a32c3d',
      kind: 'EXPENSE',
      monthly: [0, 0, 0, 0, 0, 0, 20_000, 10_000, 20_000, 0, 0, 0],
      total: 50_000,
      monthlyAverage: 0,
      subcategories: [],
    },
  ],
  totals: { income: 1_072_000, expense: 887_800, balance: 184_200 },
};

function renderBudget(initialEntry = '/budgets/2026/3') {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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

describe('BudgetPage', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/budgets/:year/:quarter', () => HttpResponse.json(BUDGET)),
      http.get('/api/categories', () => HttpResponse.json([CATEGORY, NEW_CATEGORY])),
      http.get('/api/reports/yearly', () => HttpResponse.json(YEARLY_REPORT)),
    );
  });

  it('loads a populated quarter and navigates to adjacent and directly selected quarters', async () => {
    const { user, router } = renderBudget();
    expect(await screen.findByDisplayValue('10.500,00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bônus em setembro')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próximo trimestre' }));
    expect(router.state.location.pathname).toBe('/budgets/2026/4');
    await user.selectOptions(screen.getByLabelText('Trimestre'), '2027-2');
    expect(router.state.location.pathname).toBe('/budgets/2027/2');
  });

  it('derives the quarterly review from yearly report months and Income Categories', async () => {
    renderBudget();

    expect(await screen.findByText('Receita: estimada × realizada')).toBeInTheDocument();
    const review = screen.getByLabelText('Compare com o que aconteceu');
    expect(within(review).getByText('10.720,00 €')).toBeInTheDocument();
    expect(within(review).getByText('220,00 €')).toBeInTheDocument();
    expect(within(review).getByText('2.10%')).toBeInTheDocument();
    expect(within(review).getByText('3.000,00 €')).toBeInTheDocument();
    expect(within(review).getByText('4.000,00 €')).toBeInTheDocument();
    expect(within(review).getByText('3.720,00 €')).toBeInTheDocument();
    expect(within(review).getByText('Salário')).toBeInTheDocument();
    expect(within(review).getByText('Bônus')).toBeInTheDocument();
    const incomeCategories = within(review).getByRole('heading', { name: 'Receita por categoria' }).parentElement!;
    expect(within(incomeCategories).queryByText('Moradia')).not.toBeInTheDocument();
    expect(within(review).getByText('−8.578,00 €')).toBeInTheDocument();
    expect(screen.getByText('Superávit realizado').parentElement).toHaveTextContent('1.842,00 €');
  });

  it('shows a no-activity state when the quarter has no actual results', async () => {
    server.use(
      http.get('/api/reports/yearly', () =>
        HttpResponse.json({ ...YEARLY_REPORT, months: YEARLY_REPORT.months.map((month) => ({ ...month, income: 0, expense: 0, balance: 0 })), categories: [] }),
      ),
    );
    renderBudget();
    expect(await screen.findByText('Ainda não há Receita ou Despesa confirmada neste trimestre.')).toBeInTheDocument();
  });

  it('keeps the Budget editable when actual results fail to load', async () => {
    server.use(http.get('/api/reports/yearly', () => HttpResponse.json({}, { status: 503 })));
    renderBudget();
    expect(await screen.findByText('Não foi possível carregar os resultados realizados')).toBeInTheDocument();
    expect(screen.getByLabelText('Receita estimada no trimestre')).toBeInTheDocument();
  });

  it('does not create an absent Budget until the first valid edit has been idle for 800 ms', async () => {
    let writes = 0;
    server.use(
      http.get('/api/budgets/:year/:quarter', () => new HttpResponse(null, { status: 204 })),
      http.put('/api/budgets/:year/:quarter', async ({ request }) => {
        writes += 1;
        return HttpResponse.json({ ...BUDGET, ...((await request.json()) as object) });
      }),
    );
    const { user } = renderBudget();
    await user.click(await screen.findByRole('button', { name: 'Começar pela receita' }));
    expect(writes).toBe(0);
    await user.type(screen.getByLabelText('Receita estimada no trimestre'), '10500');
    expect(screen.getByRole('status')).toHaveTextContent('1 alteração não salva');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(writes).toBe(0);
    await waitFor(() => expect(writes).toBe(1), { timeout: 700 });
    expect(await screen.findByRole('status')).toHaveTextContent('Orçamento salvo');
  });

  it('counts changed fields rather than keystrokes and suspends autosave for invalid Income', async () => {
    let writes = 0;
    server.use(
      http.put('/api/budgets/:year/:quarter', () => {
        writes += 1;
        return HttpResponse.json(BUDGET);
      }),
    );
    const { user } = renderBudget();
    const income = await screen.findByLabelText('Receita estimada no trimestre');
    await user.clear(income);
    await user.type(income, '0');
    await user.clear(screen.getByLabelText('Nota do trimestre'));
    await user.type(screen.getByLabelText('Nota do trimestre'), 'Nova nota longa');

    expect(income).toHaveAccessibleDescription(expect.stringContaining('Informe uma receita maior que zero.'));
    expect(screen.getByRole('status')).toHaveTextContent('Corrija o valor destacado');
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(writes).toBe(0);
  });

  it('protects quarter navigation while local input is invalid', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user, router } = renderBudget();
    const income = await screen.findByLabelText('Receita estimada no trimestre');
    await user.clear(income);
    await user.click(screen.getByRole('button', { name: 'Próximo trimestre' }));

    expect(confirm).toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/budgets/2026/3');
    confirm.mockRestore();
  });

  it('retains local edits after a failed save and retries on request', async () => {
    let attempts = 0;
    server.use(
      http.put('/api/budgets/:year/:quarter', async ({ request }) => {
        attempts += 1;
        const body = (await request.json()) as object;
        return attempts === 1 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json({ ...BUDGET, ...body });
      }),
    );
    const { user } = renderBudget();
    const note = await screen.findByLabelText('Nota do trimestre');
    await user.clear(note);
    await user.type(note, 'Manter esta edição');

    expect(await screen.findByText('Não foi possível salvar', {}, { timeout: 1500 })).toBeInTheDocument();
    expect(note).toHaveValue('Manter esta edição');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(attempts).toBe(2));
    expect(await screen.findByRole('status')).toHaveTextContent('Orçamento salvo');
  });

  it('offers retry for a recoverable loading failure', async () => {
    let attempts = 0;
    server.use(http.get('/api/budgets/:year/:quarter', () => (++attempts === 1 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json(BUDGET))));
    const { user } = renderBudget();
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByDisplayValue('10.500,00')).toBeInTheDocument();
  });

  it('preserves a manual monthly amount, can reset it to the calculated target, and sends the complete allocation set', async () => {
    let payload: { allocations: { categoryId: string; targetPercentage: number; adjustedMonthlyAmount: number }[] } | undefined;
    server.use(
      http.put('/api/budgets/:year/:quarter', async ({ request }) => {
        payload = (await request.json()) as { allocations: { categoryId: string; targetPercentage: number; adjustedMonthlyAmount: number }[] };
        return HttpResponse.json({ ...BUDGET, ...(payload as object) });
      }),
    );
    const { user } = renderBudget();
    expect(await screen.findByLabelText('Valor mensal ajustado de Moradia')).toHaveValue('100,00');
    await user.click(screen.getByRole('button', { name: 'Limpar ajuste e usar a meta mensal de Moradia' }));
    expect(screen.getByLabelText('Valor mensal ajustado de Moradia')).toHaveValue('700,00');
    await waitFor(() =>
      expect(payload?.allocations).toContainEqual(expect.objectContaining({ categoryId: 'c1', targetPercentage: 20, adjustedMonthlyAmount: 70_000 })),
    );
  });

  it('shows an over-allocation warning without blocking autosave', async () => {
    let writes = 0;
    server.use(
      http.put('/api/budgets/:year/:quarter', async ({ request }) => {
        writes += 1;
        return HttpResponse.json({ ...BUDGET, ...((await request.json()) as object) });
      }),
    );
    const { user } = renderBudget();
    const monthly = await screen.findByLabelText('Valor mensal ajustado de Moradia');
    await user.clear(monthly);
    await user.type(monthly, '50000');
    expect(await screen.findByText(/O total efetivo ultrapassa a receita estimada/)).toBeInTheDocument();
    await waitFor(() => expect(writes).toBe(1), { timeout: 1500 });
  });

  it('calculates a new allocation once and preserves an existing manual override when Income changes', async () => {
    const { user } = renderBudget();
    const income = await screen.findByLabelText('Receita estimada no trimestre');
    await user.clear(income);
    await user.type(income, '12000');
    expect(screen.getByLabelText('Valor mensal ajustado de Moradia')).toHaveValue('100,00');

    const percentage = screen.getByLabelText('Meta percentual de Lazer');
    await user.clear(percentage);
    await user.type(percentage, '10');
    expect(screen.getByLabelText('Valor mensal ajustado de Lazer')).toHaveValue('400,00');
  });

  it('keeps an allocated inactive Category, but omits inactive Categories without an allocation', async () => {
    const inactive = { ...NEW_CATEGORY, id: 'c3', name: 'Arquivada', isActive: false };
    const unallocatedInactive = { ...NEW_CATEGORY, id: 'c4', name: 'Removida', isActive: false };
    server.use(
      http.get('/api/budgets/:year/:quarter', () =>
        HttpResponse.json({ ...BUDGET, allocations: [...BUDGET.allocations, { ...BUDGET.allocations[0], categoryId: inactive.id, category: inactive }] }),
      ),
      http.get('/api/categories', () => HttpResponse.json([CATEGORY, NEW_CATEGORY, unallocatedInactive])),
    );

    renderBudget();

    expect(await screen.findByLabelText('Meta percentual de Arquivada')).toBeInTheDocument();
    expect(screen.getByText('inativa')).toBeInTheDocument();
    expect(screen.queryByLabelText('Meta percentual de Removida')).not.toBeInTheDocument();
  });
});

import { type AccountDto, type CategoryDto, type RecurrenceRuleDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecurrencesPage } from './recurrences-page';

import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test/server';

const ACCOUNT: AccountDto = {
  id: 'acc-1',
  name: 'Millennium',
  initialBalance: 0,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const CATEGORY: CategoryDto = {
  id: 'cat-1',
  parentId: null,
  name: 'Moradia',
  kind: 'EXPENSE',
  color: '#3355ff',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  children: [],
};

const ENDLESS_RULE: RecurrenceRuleDto = {
  id: 'rule-1',
  type: 'EXPENSE',
  amount: 6250,
  description: 'Seguro do carro',
  notes: null,
  accountId: ACCOUNT.id,
  categoryId: CATEGORY.id,
  subcategoryId: null,
  frequency: 'MONTHLY',
  interval: 1,
  dayOfMonth: 10,
  startDate: '2026-01-10',
  endDate: null,
  totalOccurrences: null,
  autoConfirm: true,
  isActive: true,
  generatedUntil: '2026-08-10',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const INACTIVE_RULE: RecurrenceRuleDto = {
  ...ENDLESS_RULE,
  id: 'rule-2',
  description: 'Netflix',
  isActive: false,
  amount: 1399,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RecurrencesPage />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('RecurrencesPage', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACCOUNT])),
      http.get('/api/categories', () => HttpResponse.json([CATEGORY])),
    );
  });

  it('lists active rules by default and reveals inactive ones with the toggle', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get('/api/recurrence-rules', ({ request }) => {
        requestUrl = new URL(request.url);
        const includeInactive = requestUrl.searchParams.get('includeInactive') === 'true';
        return HttpResponse.json(includeInactive ? [ENDLESS_RULE, INACTIVE_RULE] : [ENDLESS_RULE]);
      }),
    );

    const { user } = renderPage();

    expect(await screen.findByText('Seguro do carro')).toBeInTheDocument();
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Mostrar inativas' }));

    expect(await screen.findByText('Netflix')).toBeInTheDocument();
    expect(requestUrl?.searchParams.get('includeInactive')).toBe('true');
  });

  it('shows "sem fim" for an open-ended rule instead of a progress fraction', async () => {
    server.use(http.get('/api/recurrence-rules', () => HttpResponse.json([ENDLESS_RULE])));

    renderPage();

    expect(await screen.findByText('sem fim')).toBeInTheDocument();
  });

  it('shows the empty state explaining the two kinds of recurrence', async () => {
    server.use(http.get('/api/recurrence-rules', () => HttpResponse.json([])));

    renderPage();

    expect(await screen.findByText('Nenhuma recorrência ainda')).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    let calls = 0;
    server.use(
      http.get('/api/recurrence-rules', () => {
        calls += 1;
        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([ENDLESS_RULE]);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Não foi possível carregar as recorrências');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Seguro do carro')).toBeInTheDocument();
  });

  it('runs generate-now and reports how many entries were created', async () => {
    server.use(
      http.get('/api/recurrence-rules', () => HttpResponse.json([ENDLESS_RULE])),
      http.post('/api/recurrence-rules/:id/generate', () => HttpResponse.json({ created: 3, generatedUntil: '2026-10-10' })),
    );

    const { user } = renderPage();

    await screen.findByText('Seguro do carro');
    await user.click(screen.getByRole('button', { name: 'Gerar agora' }));

    expect(await screen.findByText('3 lançamentos criados')).toBeInTheDocument();
  });

  it('reports when generate-now created nothing, without erroring', async () => {
    server.use(
      http.get('/api/recurrence-rules', () => HttpResponse.json([ENDLESS_RULE])),
      http.post('/api/recurrence-rules/:id/generate', () => HttpResponse.json({ created: 0, generatedUntil: '2026-08-10' })),
    );

    const { user } = renderPage();

    await screen.findByText('Seguro do carro');
    await user.click(screen.getByRole('button', { name: 'Gerar agora' }));

    expect(await screen.findByText(/já está materializada até/)).toBeInTheDocument();
  });

  it('deactivates an open-ended rule through ConfirmDialog, and does not fire on cancel', async () => {
    let deactivateCalls = 0;
    server.use(
      http.get('/api/recurrence-rules', () => HttpResponse.json([ENDLESS_RULE])),
      http.post('/api/recurrence-rules/:id/deactivate', () => {
        deactivateCalls += 1;
        return HttpResponse.json({ ...ENDLESS_RULE, isActive: false });
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Seguro do carro');
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(deactivateCalls).toBe(0);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(deactivateCalls).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    const confirmDialog = await screen.findByRole('dialog');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(deactivateCalls).toBe(1));
  });

  it('cancels an installment plan through the destructive ConfirmDialog', async () => {
    const plan: RecurrenceRuleDto = { ...ENDLESS_RULE, id: 'plan-1', description: 'Colchão Ikea', totalOccurrences: 3, endDate: '2026-03-05' };
    let cancelCalls = 0;
    server.use(
      http.get('/api/recurrence-rules', () => HttpResponse.json([plan])),
      http.post('/api/recurrence-rules/:id/cancel-installments', () => {
        cancelCalls += 1;
        return HttpResponse.json({ deleted: 2 });
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Colchão Ikea');
    await user.click(screen.getByRole('button', { name: 'Cancelar parcelas futuras' }));

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Cancelar parcelas futuras' });
    expect(confirmButton).toHaveAttribute('data-variant', 'destructive');
    await user.click(confirmButton);

    await waitFor(() => expect(cancelCalls).toBe(1));
    expect(await screen.findByText('2 parcelas futuras removidas')).toBeInTheDocument();
  });
});

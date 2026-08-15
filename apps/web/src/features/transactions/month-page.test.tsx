import { type TransactionListDto, type TransactionListItemDto, TransactionStatus, TransactionType } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MonthPage } from './month-page';

import { server } from '@/test/server';

const { toastSuccess, toastError, lastUndo, lastOptions, lastMessage } = vi.hoisted(() => {
  let undo: (() => void) | undefined;
  let options: { duration?: number; action?: { label?: string; onClick?: () => void } } | undefined;
  let message = '';
  return {
    toastSuccess: vi.fn((_: string, toastOptions?: { duration?: number; action?: { label?: string; onClick?: () => void } }) => {
      message = _;
      undo = toastOptions?.action?.onClick;
      options = toastOptions;
    }),
    toastError: vi.fn(),
    lastUndo: () => undo,
    lastOptions: () => options,
    lastMessage: () => message,
  };
});
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

const CONFIRMED: TransactionListItemDto = {
  id: 'confirmed-1',
  type: TransactionType.EXPENSE,
  status: TransactionStatus.CONFIRMED,
  source: 'MANUAL',
  amount: 12345,
  date: '2026-07-14',
  referenceMonth: '2026-07-01',
  description: 'Groceries',
  notes: null,
  isCreditCard: true,
  accountId: 'account-1',
  destinationAccountId: null,
  categoryId: 'category-1',
  subcategoryId: null,
  cashboxId: null,
  destinationCashboxId: null,
  cashboxLabel: null,
  destinationCashboxLabel: null,
  createdAt: '2026-07-14T10:00:00.000Z',
  updatedAt: '2026-07-14T10:00:00.000Z',
  account: { id: 'account-1', name: 'Millennium' },
  category: { id: 'category-1', name: 'Food', color: '#ef6c00' },
  subcategory: null,
};

const DRAFT: TransactionListItemDto = { ...CONFIRMED, id: 'draft-1', status: TransactionStatus.DRAFT, description: 'Voice draft', isCreditCard: false };
const CASHBOX_TRANSFER: TransactionListItemDto = {
  ...CONFIRMED,
  id: 'cashbox-transfer-1',
  type: TransactionType.CASHBOX_TRANSFER,
  amount: 50000,
  description: 'Holiday fund move',
  accountId: null,
  categoryId: null,
  cashboxId: 'cashbox-1',
  destinationCashboxId: 'cashbox-2',
  cashboxLabel: 'Holiday fund',
  destinationCashboxLabel: 'Home repairs',
  account: null,
  category: null,
};

function page(items: TransactionListItemDto[], overrides: Partial<TransactionListDto> = {}): TransactionListDto {
  return { items, total: items.length, incomeTotal: 0, expenseTotal: 12345, cashboxInTotal: 0, cashboxOutTotal: 0, nextCursor: null, ...overrides };
}

function renderPage(initialEntry = '/month/2026/07') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/month/:year/:month', element: <MonthPage /> }], { initialEntries: [initialEntry] });

  return {
    user: userEvent.setup(),
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

async function expectTextToBePresent(text: string) {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
}

describe('MonthPage', () => {
  afterEach(() => vi.useRealTimers());

  it('loads confirmed entries and drafts separately for the route reference month', async () => {
    const requests: URL[] = [];
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        return HttpResponse.json(url.searchParams.get('status') === 'DRAFT' ? page([DRAFT]) : page([CONFIRMED]));
      }),
    );

    renderPage();

    await expectTextToBePresent('Groceries');
    expect(screen.getAllByText('14/07')).toHaveLength(2);
    await expectTextToBePresent('Voice draft');
    await expectTextToBePresent('1 lançamento · 1 rascunho');
    await expectTextToBePresent('+ 0,00 €');
    await expectTextToBePresent('− 123,45 €');

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.searchParams.get('referenceMonth'))).toEqual(['2026-07-01', '2026-07-01']);
    expect(requests.map((request) => request.searchParams.get('status'))).toEqual([null, 'DRAFT']);
  });

  it('uses the cashbox tag with transfer amount and stripe for cashbox transfers', async () => {
    server.use(
      http.get('/api/transactions', ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get('status') === 'DRAFT' ? page([]) : page([CASHBOX_TRANSFER])),
      ),
    );

    renderPage();

    const badge = await screen.findByText('Transferência');
    expect(badge).toHaveClass('text-cashbox');
    expect(screen.getByText('500,00 €')).toHaveClass('text-transfer');
    expect(badge.closest('article')).toHaveStyle({ borderLeftColor: 'var(--transfer)' });
  });

  it('debounces the server-side description search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const searches: string[] = [];
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('status') !== 'DRAFT') searches.push(url.searchParams.get('search') ?? '');
        return HttpResponse.json(page([]));
      }),
    );

    const { user } = renderPage();
    await screen.findByText('Nada lançado em Julho de 2026');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar lançamentos' }), 'gro');
    await vi.advanceTimersByTimeAsync(299);
    expect(searches).toEqual(['']);
    await vi.advanceTimersByTimeAsync(1);

    await waitFor(() => expect(searches).toEqual(['', 'gro']));
  });

  it('moves to the preceding month from the header control', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json(page([]))));
    const { user, router } = renderPage();

    await screen.findByText('Nada lançado em Julho de 2026');
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/month/2026/06'));
  });

  it('redirects malformed month parameters to the current month route', async () => {
    const { router } = renderPage('/month/2026/13');

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/month\/\d{4}\/(0[1-9]|1[0-2])$/));
  });

  it('shows the approved month-list controls without a generic table', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json(page([]))));

    renderPage();

    await screen.findByText('Nada lançado em Julho de 2026');

    expect(screen.getAllByRole('button', { name: 'Novo lançamento' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Movimentar caixinha' })).toBeEnabled();
    expect(screen.getByText('Aqui são as despesas dia a dia.')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.getByText('Conta 1')).toBeInTheDocument();
    expect(screen.getByText('Conta 2')).toBeInTheDocument();
    expect(screen.getByText('Conta 3')).toBeInTheDocument();
    expect(screen.getByText('Saldo total')).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Data — mais recente',
      'Data — mais antiga',
      'Valor — maior',
      'Valor — menor',
      'Descrição — A a Z',
    ]);
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('opens the cashbox operation dialog from the monthly tab', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json(page([]))));
    const { user } = renderPage();

    await screen.findByText('Nada lançado em Julho de 2026');
    await user.click(screen.getByRole('button', { name: 'Movimentar caixinha' }));

    expect(screen.getByRole('heading', { name: 'Operação de caixinha' })).toBeInTheDocument();
  });

  it('opens the new-entry dialog from the header action', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json(page([]))));
    const { user } = renderPage();

    await screen.findByText('Nada lançado em Julho de 2026');
    await user.click(screen.getAllByRole('button', { name: 'Novo lançamento' }).at(0)!);

    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Novo lançamento');
  });

  it('opens the new-entry dialog from the empty state action', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json(page([]))));
    const { user } = renderPage();

    await screen.findByText('Nada lançado em Julho de 2026');
    await user.click(screen.getAllByRole('button', { name: 'Novo lançamento' }).at(-1)!);

    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Novo lançamento');
  });

  it('fetches the next confirmed page when the load-more control is used', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('status') === 'DRAFT') return HttpResponse.json(page([]));
        const cursor = url.searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(
          cursor ? page([{ ...CONFIRMED, id: 'confirmed-2', description: 'Fuel' }]) : page([CONFIRMED], { nextCursor: 'cursor-1', total: 2 }),
        );
      }),
    );

    const { user } = renderPage();
    await expectTextToBePresent('Groceries');
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await expectTextToBePresent('Fuel');
    expect(cursors).toEqual([null, 'cursor-1']);
  });

  it('routes an income or expense row edit to the prefilled entry dialog', async () => {
    server.use(
      http.get('/api/transactions', ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get('status') === 'DRAFT' ? page([]) : page([CONFIRMED])),
      ),
      http.get('/api/accounts', () => HttpResponse.json([{ id: 'account-1', name: 'Millennium' }])),
      http.get('/api/categories', () => HttpResponse.json([{ id: 'category-1', name: 'Food', kind: 'EXPENSE', isActive: true, children: [] }])),
    );

    const { user } = renderPage();
    await expectTextToBePresent('Groceries');
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Novo lançamento');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Groceries');
    expect(screen.getByLabelText('Valor')).toHaveValue('123,45 €');
  });

  it('confirms deletion, invalidates the list, and exposes undo recreation', async () => {
    let deleted = false;
    let deleteRequest: string | undefined;
    server.use(
      http.get('/api/transactions', ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get('status') === 'DRAFT' ? page([]) : page(deleted ? [] : [CONFIRMED])),
      ),
      http.delete('/api/transactions/:id', ({ params }) => {
        deleted = true;
        deleteRequest = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/transactions', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...CONFIRMED, id: 'restored-1', ...body }, { status: 201 });
      }),
    );

    const { user } = renderPage();
    await expectTextToBePresent('Groceries');
    await user.click(screen.getByRole('button', { name: 'Apagar' }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Apagar lançamento?');
    expect(screen.getByRole('dialog')).toHaveTextContent('Groceries');
    await user.click(screen.getAllByRole('button', { name: /^Apagar$/ }).at(-1)!);
    await waitFor(() => expect(deleteRequest).toBe('confirmed-1'));
    expect(lastMessage()).toBe('Lançamento apagado.');
    expect(lastOptions()?.duration).toBe(10_000);
    expect(lastOptions()?.action?.label).toBe('Desfazer');

    lastUndo()?.();
    await waitFor(() => expect(lastMessage()).toBe('Lançamento restaurado.'));
  });

  it('keeps the confirmation open when deletion fails', async () => {
    server.use(
      http.get('/api/transactions', ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get('status') === 'DRAFT' ? page([]) : page([CONFIRMED])),
      ),
      http.delete('/api/transactions/:id', () => HttpResponse.json({ code: 'RECORD_IN_USE', message: 'Cannot delete' }, { status: 409 })),
    );

    const { user } = renderPage();
    await expectTextToBePresent('Groceries');
    await user.click(screen.getByRole('button', { name: 'Apagar' }));
    await user.click(screen.getAllByRole('button', { name: /^Apagar$/ }).at(-1)!);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

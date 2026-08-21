import {
  type AccountBalanceDto,
  type CashboxBalanceDto,
  type TransactionListDto,
  type TransactionListItemDto,
  TransactionStatus,
  TransactionType,
} from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MonthPage } from './month-page';

import { formatCents } from '@/lib/money';
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
  recurrenceRuleId: null,
  installmentNumber: null,
  installmentTotal: null,
  account: { id: 'account-1', name: 'Millennium' },
  category: { id: 'category-1', name: 'Food', color: '#ef6c00' },
  subcategory: null,
};

const DRAFT: TransactionListItemDto = { ...CONFIRMED, id: 'draft-1', status: TransactionStatus.DRAFT, description: 'Voice draft', isCreditCard: false };
const RECURRING: TransactionListItemDto = { ...CONFIRMED, id: 'recurring-1', source: 'RECURRING', description: 'Rent' };
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

const ACCOUNT_BALANCES: AccountBalanceDto[] = [{ accountId: 'account-1', name: 'Millennium', isActive: true, initialBalance: 0, balance: 348215 }];
const CASHBOX_BALANCES: CashboxBalanceDto[] = [{ cashboxId: 'cashbox-1', name: 'Holiday fund', isActive: true, targetAmount: null, balance: 415000 }];

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
  // EntryDialog and CashboxOperationDialog are always mounted (only their `open` prop changes) and
  // fetch accounts/cashboxes unconditionally, regardless of the ticket under test here. The month
  // page itself always fetches accounts and categories too, for the account/category filters.
  beforeEach(() => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([])),
      http.get('/api/categories', () => HttpResponse.json([])),
      http.get('/api/cashboxes', () => HttpResponse.json([])),
      http.get('/api/accounts/balances', () => HttpResponse.json([])),
      http.get('/api/cashboxes/balances', () => HttpResponse.json([])),
    );
  });

  afterEach(() => vi.useRealTimers());

  // Every render mounts `BalancePanel`, so every test needs these two handled — most don't care
  // about the actual numbers, only that the request doesn't trip `onUnhandledRequest: 'error'`.
  beforeEach(() => {
    server.use(
      http.get('/api/accounts/balances', () => HttpResponse.json(ACCOUNT_BALANCES)),
      http.get('/api/cashboxes/balances', () => HttpResponse.json(CASHBOX_BALANCES)),
    );
  });

  it('loads confirmed entries and drafts separately for the route reference month', async () => {
    const requests: URL[] = [];
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('type') === 'EXPENSE') return HttpResponse.json(page([]));
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
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('type') === 'EXPENSE') return HttpResponse.json(page([]));
        return HttpResponse.json(url.searchParams.get('status') === 'DRAFT' ? page([]) : page([CASHBOX_TRANSFER]));
      }),
    );

    renderPage();

    const badge = await screen.findByText('Transferência');
    expect(badge).toHaveClass('text-cashbox');
    expect(screen.getByText('500,00 €')).toHaveClass('text-transfer');
    expect(badge.closest('article')).toHaveStyle({ borderLeftColor: 'var(--transfer)' });
  });

  it('marks recurring entries without marking manual entries', async () => {
    server.use(
      http.get('/api/transactions', ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.get('status') === 'DRAFT' ? page([]) : page([CONFIRMED, RECURRING])),
      ),
    );

    renderPage();

    expect(await screen.findByLabelText('Lançamento recorrente')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Lançamento recorrente')).toHaveLength(1);
  });

  it('debounces the server-side description search', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const searches: string[] = [];
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('type') !== 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') {
          searches.push(url.searchParams.get('search') ?? '');
        }
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
    expect(screen.getByText('Despesas dia a dia')).toBeInTheDocument();
    expect(screen.getByText('altura = quanto saiu · cada cor = uma categoria daquele dia')).toBeInTheDocument();
    expect(await screen.findByText('Millennium')).toBeInTheDocument();
    expect(screen.getByText(formatCents(348215))).toBeInTheDocument();
    expect(screen.getByText('Caixinhas')).toBeInTheDocument();
    expect(screen.getByText('Total consolidado')).toBeInTheDocument();
    expect(screen.getByText(formatCents(348215 + 415000))).toBeInTheDocument();
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
        if (url.searchParams.get('type') === 'EXPENSE') return HttpResponse.json(page([]));
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

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Editar lançamento');
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

  describe('filters and sort (M5-T07)', () => {
    const CATEGORY_ROOT = { id: 'category-1', name: 'Food', parentId: null };
    const ACCOUNT_OPTION = { id: 'account-1', name: 'Millennium' };

    function captureTransactionRequests(itemsBySort: Record<string, TransactionListItemDto[]> = {}) {
      const requests: URL[] = [];
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
          requests.push(url);
          if (url.searchParams.get('status') === 'DRAFT') return HttpResponse.json(page([]));
          const sort = url.searchParams.get('sort') ?? 'newest';
          return HttpResponse.json(page(itemsBySort[sort] ?? [CONFIRMED]));
        }),
      );
      return requests;
    }

    it('sends the selected type filter on both the confirmed and the draft requests', async () => {
      const requests: URL[] = [];
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
          requests.push(url);
          return HttpResponse.json(page([]));
        }),
      );

      const { user } = renderPage();
      await screen.findByText('Nada lançado em Julho de 2026');

      await user.click(screen.getByRole('combobox', { name: 'Filtrar por tipo' }));
      await user.click(await screen.findByRole('option', { name: 'Receita' }));

      await waitFor(() => expect(requests.filter((r) => r.searchParams.get('type') === 'INCOME')).toHaveLength(2));
      expect(requests.filter((r) => r.searchParams.get('type') === 'INCOME' && r.searchParams.get('status') === 'DRAFT')).toHaveLength(1);
    });

    it('sends categoryId/accountId once selected, and drops them again on "all"; two filters compose on one request', async () => {
      server.use(
        http.get('/api/categories', () => HttpResponse.json([CATEGORY_ROOT])),
        http.get('/api/accounts', () => HttpResponse.json([ACCOUNT_OPTION])),
      );
      const requests: URL[] = [];
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
          if (url.searchParams.get('status') !== 'DRAFT') requests.push(url);
          return HttpResponse.json(page([]));
        }),
      );

      const { user } = renderPage();
      await screen.findByText('Nada lançado em Julho de 2026');

      await user.click(screen.getByRole('combobox', { name: 'Filtrar por categoria' }));
      await user.click(await screen.findByRole('option', { name: 'Food' }));
      await waitFor(() => expect(requests.at(-1)?.searchParams.get('categoryId')).toBe('category-1'));

      await user.click(screen.getByRole('combobox', { name: 'Filtrar por conta' }));
      await user.click(await screen.findByRole('option', { name: 'Millennium' }));
      await waitFor(() => {
        const last = requests.at(-1)!;
        expect(last.searchParams.get('categoryId')).toBe('category-1');
        expect(last.searchParams.get('accountId')).toBe('account-1');
      });

      await user.click(screen.getByRole('combobox', { name: 'Filtrar por categoria' }));
      await user.click(await screen.findByRole('option', { name: 'Categoria: todas' }));
      await waitFor(() => {
        const last = requests.at(-1)!;
        expect(last.searchParams.get('categoryId')).toBeNull();
        expect(last.searchParams.get('accountId')).toBe('account-1');
      });
    });

    it('resets pagination (no cursor) when a filter changes after loading a second page', async () => {
      server.use(http.get('/api/accounts', () => HttpResponse.json([ACCOUNT_OPTION])));
      const cursors: (string | null)[] = [];
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
          if (url.searchParams.get('status') === 'DRAFT') return HttpResponse.json(page([]));
          const cursor = url.searchParams.get('cursor');
          cursors.push(cursor);
          return HttpResponse.json(
            cursor || url.searchParams.get('accountId')
              ? page([{ ...CONFIRMED, id: 'confirmed-2', description: 'Fuel' }])
              : page([CONFIRMED], { nextCursor: 'cursor-1', total: 2 }),
          );
        }),
      );

      const { user } = renderPage();
      await expectTextToBePresent('Groceries');
      await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
      await expectTextToBePresent('Fuel');
      expect(cursors).toEqual([null, 'cursor-1']);

      await user.click(screen.getByRole('combobox', { name: 'Filtrar por conta' }));
      await user.click(await screen.findByRole('option', { name: 'Millennium' }));

      await waitFor(() => expect(cursors.at(-1)).toBeNull());
    });

    it('sends the selected sort on both requests and renders rows in the order the server returned, unmodified', async () => {
      const requests = captureTransactionRequests({ oldest: [{ ...CONFIRMED, id: 'confirmed-2', description: 'Old one' }, CONFIRMED] });

      const { user } = renderPage();
      await expectTextToBePresent('Groceries');

      await user.selectOptions(screen.getByLabelText('Ordenar'), 'Data — mais antiga');

      await waitFor(() => expect(requests.some((r) => r.searchParams.get('sort') === 'oldest')).toBe(true));
      expect(requests.filter((r) => r.searchParams.get('sort') === 'oldest' && r.searchParams.get('status') === 'DRAFT')).toHaveLength(1);

      const descriptions = (await screen.findAllByText(/Old one|Groceries/)).map((node) => node.textContent);
      expect(descriptions).toEqual(['Old one', 'Groceries']);
    });

    it('resets pagination (no cursor) when the sort changes after loading a second page', async () => {
      const cursors: (string | null)[] = [];
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
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

      await user.selectOptions(screen.getByLabelText('Ordenar'), 'Valor — maior');

      await waitFor(() => expect(cursors.at(-1)).toBeNull());
    });

    it('keeps a draft row first regardless of the selected sort', async () => {
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
          return HttpResponse.json(url.searchParams.get('status') === 'DRAFT' ? page([DRAFT]) : page([CONFIRMED]));
        }),
      );

      const { user } = renderPage();
      await expectTextToBePresent('Groceries');
      await expectTextToBePresent('Voice draft');

      await user.selectOptions(screen.getByLabelText('Ordenar'), 'Descrição — A a Z');

      const rows = await screen.findAllByRole('article');
      expect(rows[0]).toHaveTextContent('Voice draft');
    });

    it('shows the filtered-empty state when a filter matches nothing, and "Limpar filtros" restores the unfiltered request', async () => {
      const requests: URL[] = [];
      server.use(
        http.get('/api/transactions', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('type') === 'EXPENSE' && url.searchParams.get('status') !== 'DRAFT') return HttpResponse.json(page([]));
          if (url.searchParams.get('status') === 'DRAFT') return HttpResponse.json(page([]));
          requests.push(url);
          return HttpResponse.json(url.searchParams.get('type') === 'INCOME' ? page([]) : page([CONFIRMED]));
        }),
      );

      const { user } = renderPage();
      await expectTextToBePresent('Groceries');

      await user.click(screen.getByRole('combobox', { name: 'Filtrar por tipo' }));
      await user.click(await screen.findByRole('option', { name: 'Receita' }));

      await screen.findByText('Nenhum lançamento com esses filtros');
      expect(screen.queryByText('Nada lançado em Julho de 2026')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

      await expectTextToBePresent('Groceries');
      expect(requests.at(-1)?.searchParams.get('type')).toBeNull();
    });
  });
});

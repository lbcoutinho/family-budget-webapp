import { type TransactionListDto, type TransactionListItemDto, TransactionStatus, TransactionType } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MonthPage } from './month-page';

import { server } from '@/test/server';

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

    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    expect(await screen.findByText('Voice draft')).toBeInTheDocument();
    expect(screen.getByText('1 lançamento · 1 rascunho')).toBeInTheDocument();
    expect(screen.getByText('+ 0,00 €')).toBeInTheDocument();
    expect(screen.getByText('− 123,45 €')).toBeInTheDocument();

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.searchParams.get('referenceMonth'))).toEqual(['2026-07-01', '2026-07-01']);
    expect(requests.map((request) => request.searchParams.get('status'))).toEqual([null, 'DRAFT']);
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

  it('offers the disabled create action for an empty month until the entry dialog lands', async () => {
    server.use(http.get('/api/transactions', () => HttpResponse.json(page([]))));

    renderPage();

    expect(await screen.findByRole('button', { name: 'Novo lançamento' })).toBeDisabled();
  });

  it('fetches the next confirmed page when the load-more control is used', async () => {
    const cursors: Array<string | null> = [];
    server.use(
      http.get('/api/transactions', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('status') === 'DRAFT') return HttpResponse.json(page([]));
        const cursor = url.searchParams.get('cursor');
        cursors.push(cursor);
        return HttpResponse.json(cursor ? page([{ ...CONFIRMED, id: 'confirmed-2', description: 'Fuel' }]) : page([CONFIRMED], { nextCursor: 'cursor-1', total: 2 }));
      }),
    );

    const { user } = renderPage();
    await screen.findByText('Groceries');
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('Fuel')).toBeInTheDocument();
    expect(cursors).toEqual([null, 'cursor-1']);
  });
});

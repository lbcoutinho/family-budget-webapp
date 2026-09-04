import { type TransactionListItemDto, TransactionStatus, TransactionType } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { DailyExpenseStrip, type DateFilter } from './daily-expense-strip';

import { server } from '@/test/server';

const REFERENCE_MONTH = new Date(2026, 3, 1); // April 2026 — 30 days.
const REFERENCE_MONTH_ISO = '2026-04-01';

function transaction(overrides: Partial<TransactionListItemDto> & Pick<TransactionListItemDto, 'id' | 'date' | 'amount'>): TransactionListItemDto {
  return {
    type: TransactionType.EXPENSE,
    status: TransactionStatus.CONFIRMED,
    source: 'MANUAL',
    referenceMonth: REFERENCE_MONTH_ISO,
    settlementDate: overrides.settlementDate ?? overrides.date,
    description: overrides.description ?? 'Expense',
    notes: null,
    isCreditCard: true,
    accountId: 'account-1',
    destinationAccountId: null,
    categoryId: 'category-food',
    subcategoryId: null,
    cashboxId: null,
    destinationCashboxId: null,
    cashboxLabel: null,
    destinationCashboxLabel: null,
    createdAt: `${overrides.date}T10:00:00.000Z`,
    updatedAt: `${overrides.date}T10:00:00.000Z`,
    recurrenceRuleId: null,
    installmentNumber: null,
    installmentTotal: null,
    accountBalanceAfter: null,
    account: { id: 'account-1', name: 'Millennium' },
    category: { id: 'category-food', name: 'Alimentação', color: '#a85c1a' },
    subcategory: null,
    ...overrides,
  };
}

/** Mimics the API's own filtering (type + status + referenceMonth) and cursor pagination, so the
 * fixture can hold every kind of row and the handler proves the component asked for the right
 * ones — exactly what the real backend guarantees by contract. */
function mockTransactions(allItems: TransactionListItemDto[]) {
  server.use(
    http.get('/api/transactions', ({ request }) => {
      const url = new URL(request.url);
      const referenceMonth = url.searchParams.get('referenceMonth');
      const types = url.searchParams.getAll('type');
      const status = url.searchParams.get('status') ?? TransactionStatus.CONFIRMED;
      const limit = Number(url.searchParams.get('limit') ?? '200');
      const cursor = url.searchParams.get('cursor');

      const filtered = allItems.filter(
        (item) => item.referenceMonth === referenceMonth && item.status === status && (types.length === 0 || types.includes(item.type)),
      );
      const startIndex = cursor ? filtered.findIndex((item) => item.id === cursor) + 1 : 0;
      const items = filtered.slice(startIndex, startIndex + limit);
      const nextCursor = startIndex + limit < filtered.length ? items[items.length - 1]!.id : null;

      return HttpResponse.json({ items, total: filtered.length, incomeTotal: 0, expenseTotal: 0, cashboxInTotal: 0, cashboxOutTotal: 0, nextCursor });
    }),
  );
}

function renderStrip(selectedFilterId: string | undefined = undefined, onToggleFilter: (filter: DateFilter) => void = () => undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <DailyExpenseStrip referenceMonth={REFERENCE_MONTH} selectedFilterId={selectedFilterId} onToggleFilter={onToggleFilter} />
    </QueryClientProvider>,
  );
}

/** Renders with the same toggle-to-clear semantics `MonthLedger` applies, so click behaviour can be
 * asserted without duplicating the parent page in this suite. */
function StatefulStrip() {
  const [selectedFilter, setSelectedFilter] = useState<DateFilter>();

  return (
    <DailyExpenseStrip
      referenceMonth={REFERENCE_MONTH}
      selectedFilterId={selectedFilter?.id}
      onToggleFilter={(filter) => setSelectedFilter((current) => (current?.id === filter.id ? undefined : filter))}
    />
  );
}

function renderStatefulStrip() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <StatefulStrip />
      </QueryClientProvider>,
    ),
  };
}

describe('DailyExpenseStrip', () => {
  it('renders one column per day of the reference month, with the correct accessible name and total per day', async () => {
    mockTransactions([
      transaction({ id: 'e1', date: '2026-04-05', amount: 12840, description: 'Supermercado' }),
      transaction({
        id: 'e2',
        date: '2026-04-05',
        amount: 6620,
        description: 'Farmácia',
        categoryId: 'category-health',
        category: { id: 'category-health', name: 'Saúde', color: '#a32c3d' },
      }),
    ]);

    renderStrip();

    const group = await screen.findByRole('group', { name: 'Despesas por dia de Abril de 2026' });
    const days = screen.getAllByRole('button', { name: /./ });
    expect(days).toHaveLength(30);

    const fifth = within(group).getByRole('button', { name: /^5 de abril/ });
    expect(fifth).toHaveAccessibleName('5 de abril — 194,60 € — Alimentação 128,40 € · Saúde 66,20 €');
    expect(fifth).toHaveAttribute('title', '5 de abril - 2 lançamentos');

    const sixth = within(group).getByRole('button', { name: /^6 de abril/ });
    expect(sixth).toHaveAccessibleName('6 de abril — nada saiu');
  });

  it('excludes a TRANSFER, a CASHBOX_IN, a CASHBOX_OUT and a DRAFT from every column and the legend', async () => {
    mockTransactions([
      transaction({ id: 'e1', date: '2026-04-10', amount: 5000 }),
      transaction({ id: 'transfer-1', date: '2026-04-10', amount: 30000, type: TransactionType.TRANSFER }),
      transaction({ id: 'cxin-1', date: '2026-04-10', amount: 20000, type: TransactionType.CASHBOX_IN }),
      transaction({ id: 'cxout-1', date: '2026-04-10', amount: 15000, type: TransactionType.CASHBOX_OUT }),
      transaction({ id: 'draft-1', date: '2026-04-10', amount: 9999, status: TransactionStatus.DRAFT }),
    ]);

    renderStrip();

    const tenth = await screen.findByRole('button', { name: /^10 de abril/ });
    expect(tenth).toHaveAccessibleName('10 de abril — 50,00 € — Alimentação 50,00 €');
    expect(await screen.findByText('50,00 €')).toBeInTheDocument();
    expect(screen.queryByText('300,00 €')).not.toBeInTheDocument();
    expect(screen.queryByText('200,00 €')).not.toBeInTheDocument();
    expect(screen.queryByText('150,00 €')).not.toBeInTheDocument();
    expect(screen.queryByText('99,99 €')).not.toBeInTheDocument();
  });

  it('produces two segments for two expenses on the same day in different categories, ordered largest first', async () => {
    mockTransactions([
      transaction({
        id: 'small',
        date: '2026-04-12',
        amount: 1500,
        categoryId: 'category-leisure',
        category: { id: 'category-leisure', name: 'Lazer', color: '#7a45b5' },
      }),
      transaction({
        id: 'large',
        date: '2026-04-12',
        amount: 8500,
        categoryId: 'category-food',
        category: { id: 'category-food', name: 'Alimentação', color: '#a85c1a' },
      }),
    ]);

    renderStrip();

    const twelfth = await screen.findByRole('button', { name: /^12 de abril/ });
    expect(twelfth).toHaveAccessibleName('12 de abril — 100,00 € — Alimentação 85,00 € · Lazer 15,00 €');
  });

  it('reaches full height for the peak day and keeps at least the 9% floor for a small day', async () => {
    mockTransactions([transaction({ id: 'peak', date: '2026-04-01', amount: 100000 }), transaction({ id: 'tiny', date: '2026-04-02', amount: 100 })]);

    renderStrip();

    const peakDay = await screen.findByRole('button', { name: /^1 de abril/ });
    const tinyDay = await screen.findByRole('button', { name: /^2 de abril/ });

    const peakBar = peakDay.querySelector('span');
    const tinyBar = tinyDay.querySelector('span');

    expect(peakBar).toHaveStyle({ height: '100%' });
    expect(tinyBar).toHaveStyle({ height: '9%' });
  });

  it('aggregates a month whose expenses span two pages', async () => {
    const items = Array.from({ length: 250 }, (_, index) => transaction({ id: `e${index}`, date: '2026-04-15', amount: 100 }));
    mockTransactions(items);

    renderStrip();

    const fifteenth = await screen.findByRole('button', { name: /^15 de abril/ });
    expect(fifteenth).toHaveAccessibleName('15 de abril — 250,00 € — Alimentação 250,00 €');
  });

  it('lists each category present in the legend with its month total, sorted descending', async () => {
    mockTransactions([
      transaction({
        id: 'e1',
        date: '2026-04-03',
        amount: 2000,
        categoryId: 'category-leisure',
        category: { id: 'category-leisure', name: 'Lazer', color: '#7a45b5' },
      }),
      transaction({
        id: 'e2',
        date: '2026-04-20',
        amount: 9000,
        categoryId: 'category-food',
        category: { id: 'category-food', name: 'Alimentação', color: '#a85c1a' },
      }),
      transaction({
        id: 'e3',
        date: '2026-04-21',
        amount: 1000,
        categoryId: 'category-food',
        category: { id: 'category-food', name: 'Alimentação', color: '#a85c1a' },
      }),
    ]);

    renderStrip();

    await screen.findByRole('button', { name: /^3 de abril/ });
    const legendEntries = screen.getAllByText(/€$/).map((node) => node.closest('span')?.textContent);
    expect(legendEntries).toEqual(['Alimentação 100,00 €', 'Lazer 20,00 €']);
  });

  it('narrows on click and restores when the same day is clicked again', async () => {
    mockTransactions([transaction({ id: 'e1', date: '2026-04-07', amount: 5000 })]);

    const { user } = renderStatefulStrip();

    const seventh = await screen.findByRole('button', { name: /^7 de abril/ });
    expect(seventh).toHaveAttribute('aria-pressed', 'false');

    await user.click(seventh);
    expect(seventh).toHaveAttribute('aria-pressed', 'true');

    await user.click(seventh);
    expect(seventh).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders all stub columns and no legend for an empty month, without crashing', async () => {
    mockTransactions([]);

    renderStrip();

    await screen.findByRole('button', { name: /^1 de abril/ });
    expect(screen.getAllByRole('button')).toHaveLength(30);
    expect(screen.queryByRole('button', { name: /^Antes/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Depois/ })).not.toBeInTheDocument();
    expect(screen.queryAllByText(/€/)).toHaveLength(0);
  });

  it('infers a 31-day window and exposes boundary bars with every confirmed transaction on each side', async () => {
    mockTransactions([
      transaction({ id: 'first', date: '2026-08-25', amount: 1000, isCreditCard: false }),
      transaction({ id: 'last', date: '2026-09-24', amount: 2000, isCreditCard: false }),
      transaction({ id: 'before-transfer', date: '2026-08-24', amount: 5000, type: TransactionType.TRANSFER }),
      transaction({ id: 'after-income', date: '2026-09-25', amount: 5000, type: TransactionType.INCOME }),
      transaction({ id: 'ignored-draft', date: '2026-08-20', amount: 9999, status: TransactionStatus.DRAFT, isCreditCard: false }),
    ]);

    const { user } = renderStatefulStrip();

    const first = await screen.findByRole('button', { name: /^25 de agosto/ });
    expect(screen.getAllByRole('button')).toHaveLength(33);
    expect(first).toHaveAccessibleName('25 de agosto — 10,00 € — Alimentação 10,00 €');

    const before = screen.getByRole('button', { name: /^Antes — 1 lançamento — nenhuma despesa$/ });
    const after = screen.getByRole('button', { name: /^Depois — 1 lançamento — nenhuma despesa$/ });
    await user.click(before);
    expect(before).toHaveAttribute('aria-pressed', 'true');
    await user.click(before);
    expect(before).toHaveAttribute('aria-pressed', 'false');
    expect(after).toBeInTheDocument();
  });

  it('positions calendar-day markers under their matching variable chart columns', async () => {
    mockTransactions([
      transaction({ id: 'first', date: '2026-08-25', amount: 1000, isCreditCard: false }),
      transaction({ id: 'before', date: '2026-08-24', amount: 1000, type: TransactionType.TRANSFER }),
      transaction({ id: 'after', date: '2026-09-25', amount: 1000, type: TransactionType.INCOME }),
    ]);

    renderStrip();

    await screen.findByRole('button', { name: /^25 de agosto/ });
    const ticks = Array.from(screen.getByTestId('daily-expense-ticks').children);
    expect(ticks.map((tick) => tick.textContent)).toEqual(['Antes', '25', '1', '5', '10', '15', '20', 'Depois']);
    expect(ticks.map((tick) => tick.getAttribute('style'))).toEqual([
      'grid-column-start: 1;',
      'grid-column-start: 2;',
      'grid-column-start: 9;',
      'grid-column-start: 13;',
      'grid-column-start: 18;',
      'grid-column-start: 23;',
      'grid-column-start: 28;',
      'grid-column-start: 33;',
    ]);
  });

  it('does not let a credit-card expense determine the inferred start date', async () => {
    mockTransactions([
      transaction({ id: 'card', date: '2026-03-28', amount: 4000, isCreditCard: true }),
      transaction({ id: 'cash', date: '2026-04-10', amount: 1000, isCreditCard: false }),
    ]);

    renderStrip();

    await screen.findByRole('button', { name: /^10 de abril/ });
    expect(screen.queryByRole('button', { name: /^1 de abril/ })).not.toBeInTheDocument();
  });

  it('places a credit-card row outside the fallback window in the matching boundary', async () => {
    mockTransactions([transaction({ id: 'e1', date: '2026-03-28', amount: 4000, isCreditCard: true })]);

    renderStrip();

    const before = await screen.findByRole('button', { name: /^Antes/ });
    expect(before).toHaveAccessibleName('Antes — 1 lançamento — 40,00 € — Alimentação 40,00 €');
  });
});

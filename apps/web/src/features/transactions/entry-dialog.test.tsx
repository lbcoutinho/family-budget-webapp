import { getGetMonthlyBalanceQueryKey, getListTransactionsQueryKey } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { businessCodeField, EntryDialog, suggestedReferenceMonth } from './entry-dialog';

import type * as ApiClient from '@family-budget/api-client';

const categoryButtonLabel = 'choose category';
const subcategoryButtonLabel = 'choose subcategory';
const mutate = vi.fn<(variables: { data: ApiClient.CreateTransactionDto }) => void>();
const updateMutate = vi.fn<(variables: { id: string; data: ApiClient.UpdateTransactionDto }) => void>();
const { toastError, toastSuccess } = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
interface MutationOptions {
  mutation: {
    onMutate: (variables: { data: ApiClient.CreateTransactionDto }) => Promise<{ key: readonly unknown[]; previous: unknown }>;
    onError: (error: unknown, variables: unknown, context: unknown) => void;
    onSuccess: () => void;
    onSettled: () => void;
  };
}
let mutationOptions: MutationOptions | undefined;
let updateMutationOptions: MutationOptions | undefined;
let listAccountsParams: unknown;
let mutationState: { isPending: boolean; error: unknown };
let accounts = [
  { id: 'account-1', name: 'Main account' },
  { id: 'account-2', name: 'Savings' },
];

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function makeTransaction(overrides: Partial<ApiClient.TransactionListItemDto> = {}): ApiClient.TransactionListItemDto {
  return {
    id: 'transaction-1',
    type: 'EXPENSE',
    status: 'CONFIRMED',
    source: 'MANUAL',
    amount: 1000,
    date: '2026-08-15',
    referenceMonth: '2026-08-01',
    description: 'Groceries',
    notes: null,
    isCreditCard: false,
    accountId: 'account-1',
    destinationAccountId: null,
    categoryId: 'category-1',
    subcategoryId: 'subcategory-1',
    cashboxId: null,
    destinationCashboxId: null,
    cashboxLabel: null,
    destinationCashboxLabel: null,
    createdAt: '2026-08-15T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    recurrenceRuleId: null,
    installmentNumber: null,
    installmentTotal: null,
    account: { id: 'account-1', name: 'Main account' },
    category: null,
    subcategory: null,
    ...overrides,
  };
}

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock('@family-budget/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    useListAccounts: (params: unknown) => {
      listAccountsParams = params;
      return { data: accounts };
    },
    useCreateTransaction: (options: unknown) => {
      mutationOptions = options as MutationOptions;
      return { mutate, ...mutationState };
    },
    useUpdateTransaction: (options: unknown) => {
      updateMutationOptions = options as MutationOptions;
      return { mutate: updateMutate, ...mutationState };
    },
  };
});
vi.mock('./category-select', () => ({
  CategorySelect: ({
    categoryId,
    subcategoryId,
    onChange,
    categoryError,
    subcategoryError,
    categoryRef,
    subcategoryRef,
  }: {
    categoryId?: string;
    subcategoryId?: string;
    onChange: (categoryId: string | undefined, subcategoryId: string | undefined) => void;
    categoryError?: string;
    subcategoryError?: string;
    categoryRef?: { current: HTMLSelectElement | null };
    subcategoryRef?: { current: HTMLSelectElement | null };
  }) => (
    <div>
      <label htmlFor="mock-category">{categoryButtonLabel}</label>
      <select
        id="mock-category"
        ref={categoryRef}
        value={categoryId ?? ''}
        aria-describedby={categoryError ? 'entry-category-error' : undefined}
        aria-invalid={categoryError !== undefined}
        onChange={(event) => onChange(event.currentTarget.value || undefined, undefined)}
      >
        <option value="">{categoryButtonLabel}</option>
        <option value="category-1">{categoryButtonLabel}</option>
      </select>
      <output data-testid="selected-category">{categoryId}</output>
      {categoryError ? <p id="entry-category-error">{categoryError}</p> : null}
      <label htmlFor="mock-subcategory">{subcategoryButtonLabel}</label>
      <select
        id="mock-subcategory"
        ref={subcategoryRef}
        value={subcategoryId ?? ''}
        aria-describedby={subcategoryError ? 'entry-subcategory-error' : undefined}
        aria-invalid={subcategoryError !== undefined}
        onChange={(event) => onChange(categoryId ?? 'category-1', event.currentTarget.value || undefined)}
      >
        <option value="">{subcategoryButtonLabel}</option>
        <option value="subcategory-1">{subcategoryButtonLabel}</option>
      </select>
      <output data-testid="selected-subcategory">{subcategoryId}</output>
      {subcategoryError ? <p id="entry-subcategory-error">{subcategoryError}</p> : null}
    </div>
  ),
}));

function renderDialog(onOpenChange = vi.fn(), transaction?: ApiClient.TransactionListItemDto) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EntryDialog open onOpenChange={onOpenChange} transaction={transaction} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    onOpenChange,
    queryClient,
  };
}

async function fillExpense(user: ReturnType<typeof userEvent.setup>, amount = '10') {
  await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
  await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
  await user.selectOptions(screen.getByLabelText(subcategoryButtonLabel), 'subcategory-1');
  await user.type(screen.getByLabelText('transactions.form.description'), 'Groceries');
  await user.type(screen.getByLabelText('transactions.form.amount'), amount);
}

describe('entry dialog helpers', () => {
  it('suggests the first day of the next month', () => {
    expect(suggestedReferenceMonth('2026-12-31')).toBe('2027-01-01');
  });

  it.each([
    ['TRANSACTION_SAME_ACCOUNT', 'destinationAccountId'],
    ['TRANSACTION_CATEGORY_KIND_MISMATCH', 'categoryId'],
    ['TRANSACTION_SUBCATEGORY_PARENT_MISMATCH', 'subcategoryId'],
    ['TRANSACTION_FIELD_REQUIRED', undefined],
  ])('maps %s to its field', (code, field) => {
    expect(businessCodeField(code)).toBe(field);
  });
});

describe('EntryDialog', () => {
  beforeEach(() => {
    mutate.mockClear();
    updateMutate.mockClear();
    toastError.mockClear();
    toastSuccess.mockClear();
    mutationOptions = undefined;
    updateMutationOptions = undefined;
    listAccountsParams = undefined;
    mutationState = { isPending: false, error: null };
    accounts = [
      { id: 'account-1', name: 'Main account' },
      { id: 'account-2', name: 'Savings' },
    ];
  });

  it('invalidates historical monthly balances after a save settles', () => {
    const { queryClient } = renderDialog();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => mutationOptions?.mutation.onSettled());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: getGetMonthlyBalanceQueryKey() });
  });

  it('links to Accounts when none exist', () => {
    accounts = [];
    renderDialog();

    expect(screen.getByRole('link', { name: 'transactions.form.createAccount' })).toHaveAttribute('href', '/accounts');
  });

  it('exposes the account placeholder on "Conta", "De" and "Para", and clears the value when reselected', async () => {
    const { user } = renderDialog();

    const account = screen.getByLabelText('transactions.form.account');
    expect(within(account).getByRole('option', { name: 'transactions.form.accountPlaceholder' })).toBeInTheDocument();
    await user.selectOptions(account, 'account-1');
    expect(account).toHaveValue('account-1');
    await user.selectOptions(account, '');
    expect(account).toHaveValue('');

    await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));
    const source = screen.getByLabelText('transactions.form.sourceAccount');
    const destination = screen.getByLabelText('transactions.form.destinationAccount');
    expect(within(source).getByRole('option', { name: 'transactions.form.accountPlaceholder' })).toBeInTheDocument();
    expect(within(destination).getByRole('option', { name: 'transactions.form.accountPlaceholder' })).toBeInTheDocument();
  });

  it('focuses "Conta" with a red border on an empty save, and shows exactly one required error for category', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(screen.getByLabelText('transactions.form.account')).toHaveFocus();
    expect(screen.getByLabelText('transactions.form.account')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('entry-account-error')).toHaveTextContent('transactions.form.required');

    expect(screen.getByLabelText(categoryButtonLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('entry-category-error')).toHaveTextContent('transactions.form.required');
    expect(screen.getByLabelText(subcategoryButtonLabel)).not.toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('entry-subcategory-error')).toBeNull();

    expect(screen.getByLabelText('transactions.form.description')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('entry-description-error')).toHaveTextContent('transactions.form.required');
    expect(screen.getByLabelText('transactions.form.amount')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('entry-amount-error')).toHaveTextContent('transactions.form.invalidAmount');
  });

  it('advances focus to the next empty field, top to bottom, on each failed save', async () => {
    const { user } = renderDialog();
    const save = () => user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    await save();
    expect(screen.getByLabelText('transactions.form.account')).toHaveFocus();

    await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
    await save();
    expect(screen.getByLabelText(categoryButtonLabel)).toHaveFocus();

    await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
    await save();
    expect(screen.getByLabelText(subcategoryButtonLabel)).toHaveFocus();

    await user.selectOptions(screen.getByLabelText(subcategoryButtonLabel), 'subcategory-1');
    await user.type(screen.getByLabelText('transactions.form.description'), 'Groceries');
    await save();
    expect(screen.getByLabelText('transactions.form.amount')).toHaveFocus();

    expect(mutate).not.toHaveBeenCalled();
  });

  it('focuses "De" then "Para" on the transfer tab, across failed saves', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(screen.getByLabelText('transactions.form.sourceAccount')).toHaveFocus();

    await user.selectOptions(screen.getByLabelText('transactions.form.sourceAccount'), 'account-1');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(screen.getByLabelText('transactions.form.destinationAccount')).toHaveFocus();
  });

  it('blocks save when description is blank, on both the expense and transfer tabs', async () => {
    const { user } = renderDialog();

    await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
    await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
    await user.selectOptions(screen.getByLabelText(subcategoryButtonLabel), 'subcategory-1');
    await user.type(screen.getByLabelText('transactions.form.amount'), '10');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(document.getElementById('entry-description-error')).toHaveTextContent('transactions.form.required');
    expect(mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));
    await user.selectOptions(screen.getByLabelText('transactions.form.sourceAccount'), 'account-1');
    await user.selectOptions(screen.getByLabelText('transactions.form.destinationAccount'), 'account-2');
    await user.type(screen.getByLabelText('transactions.form.amount'), '10');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(document.getElementById('entry-description-error')).toHaveTextContent('transactions.form.required');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('never shows a subcategory error right after choosing a category, before or after a prior failed submit', async () => {
    const { user } = renderDialog();

    await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
    expect(document.getElementById('entry-subcategory-error')).toBeNull();

    await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
    await user.type(screen.getByLabelText('transactions.form.description'), 'Groceries');
    await user.type(screen.getByLabelText('transactions.form.amount'), '10');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(document.getElementById('entry-subcategory-error')).toHaveTextContent('transactions.form.required');

    fireEvent.change(screen.getByLabelText(categoryButtonLabel), { target: { value: 'category-1' } });
    expect(document.getElementById('entry-subcategory-error')).toBeNull();
  });

  it('places each field error as a sibling of its own control, referenced by aria-describedby', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    const categoryControl = screen.getByLabelText(categoryButtonLabel);
    expect(categoryControl).toHaveAttribute('aria-describedby', 'entry-category-error');
    expect(document.getElementById('entry-category-error')).toHaveTextContent('transactions.form.required');

    await user.selectOptions(categoryControl, 'category-1');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    const subcategoryControl = screen.getByLabelText(subcategoryButtonLabel);
    expect(subcategoryControl).toHaveAttribute('aria-describedby', 'entry-subcategory-error');
    expect(document.getElementById('entry-subcategory-error')).toHaveTextContent('transactions.form.required');
  });

  it.each([
    ['1.234,56', 123456],
    ['1234.56', 123456],
  ])('submits %s as %i cents', async (amount, cents) => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-08-15' } });
    await fillExpense(user, amount);
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    const saved = mutate.mock.calls[0]?.[0].data;
    expect(saved).toEqual({
      type: 'EXPENSE',
      amount: cents,
      date: '2026-08-15',
      referenceMonth: '2026-08-01',
      accountId: 'account-1',
      categoryId: 'category-1',
      subcategoryId: 'subcategory-1',
      description: 'Groceries',
      notes: null,
      isCreditCard: false,
    });
  });

  it('trims personal notes and rejects notes over 1,000 characters', async () => {
    const { user } = renderDialog();

    await fillExpense(user);
    await user.type(screen.getByLabelText('transactions.form.notes'), '  Pantry restock  ');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(mutate.mock.calls[0]?.[0].data).toMatchObject({ notes: 'Pantry restock' });

    mutate.mockClear();
    await user.clear(screen.getByLabelText('transactions.form.notes'));
    await user.type(screen.getByLabelText('transactions.form.notes'), 'a'.repeat(1001));
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));
    expect(document.getElementById('entry-notes-error')).toHaveTextContent('transactions.form.notesTooLong');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('blocks nonsense amounts before mutation', async () => {
    const { user } = renderDialog();

    await fillExpense(user, 'not money');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(await screen.findByText('transactions.form.invalidAmount')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.form.amount')).toHaveAttribute('aria-invalid', 'true');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('removes category fields for transfers and rejects the same account', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));
    expect(screen.queryByRole('button', { name: categoryButtonLabel })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('transactions.form.sourceAccount'), 'account-1');
    await user.selectOptions(screen.getByLabelText('transactions.form.destinationAccount'), 'account-1');
    await user.type(screen.getByLabelText('transactions.form.description'), 'Move');
    await user.type(screen.getByLabelText('transactions.form.amount'), '10');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(await screen.findByText('transactions.form.sameAccount')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows the credit-card checkbox only on the expense tab', async () => {
    const { user } = renderDialog();

    expect(screen.getByLabelText('transactions.form.creditCard')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'transactions.form.income' }));
    expect(screen.queryByLabelText('transactions.form.creditCard')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));
    expect(screen.queryByLabelText('transactions.form.creditCard')).not.toBeInTheDocument();
  });

  it('sends the calendar reference month for an income entry, even after ticking the card box on the expense tab', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    await user.click(screen.getByRole('tab', { name: 'transactions.form.income' }));
    await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
    await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
    await user.selectOptions(screen.getByLabelText(subcategoryButtonLabel), 'subcategory-1');
    await user.type(screen.getByLabelText('transactions.form.description'), 'Bonus');
    await user.type(screen.getByLabelText('transactions.form.amount'), '10');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    const saved = mutate.mock.calls[0]?.[0]?.data;
    expect(saved).toMatchObject({ type: 'INCOME', isCreditCard: false });
    expect(saved).toHaveProperty('referenceMonth', `${today().slice(0, 7)}-01`);
  });

  it('suggests the credit-card reference month and restores the calendar month when unticked', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2027-01');
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2027-01-10' } });
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2027-02');
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2027-01');
  });

  it('sends the calendar reference month after credit card is unticked', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    await fillExpense(user);
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(mutate.mock.calls[0]?.[0].data).toHaveProperty('referenceMonth', `${today().slice(0, 7)}-01`);
  });

  it('clears category and credit-card fields when switching transaction type', async () => {
    const { user } = renderDialog();

    await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    await user.click(screen.getByRole('tab', { name: 'transactions.form.income' }));

    expect(screen.getByTestId('selected-category')).toHaveTextContent('');
    expect(screen.getByTestId('selected-subcategory')).toHaveTextContent('');
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toBeInTheDocument();
  });

  it('keeps an overridden credit-card reference month after the date changes', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    fireEvent.change(screen.getByLabelText('transactions.form.referenceMonth'), { target: { value: '2026-10' } });
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2027-01-10' } });

    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-10');
  });

  it('follows a non-card date until the reference month is changed manually', () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-09-15' } });
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-09');
    fireEvent.change(screen.getByLabelText('transactions.form.referenceMonth'), { target: { value: '2026-11' } });
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-10-15' } });
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-11');
  });

  it('clears every field, resets the date, keeps the type tab, and focuses "Conta" after save and add another', async () => {
    const { user } = renderDialog();

    await fillExpense(user);
    await user.click(screen.getByRole('button', { name: 'transactions.form.saveAndAddAnother' }));
    act(() => mutationOptions?.mutation.onSuccess());

    expect(screen.getByRole('tab', { name: 'transactions.form.expense' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByLabelText('transactions.form.account')).toHaveValue('');
    expect(screen.getByTestId('selected-category')).toHaveTextContent('');
    expect(screen.getByTestId('selected-subcategory')).toHaveTextContent('');
    expect(screen.getByLabelText('transactions.form.description')).toHaveValue('');
    expect(screen.getByLabelText('transactions.form.notes')).toHaveValue('');
    expect(screen.getByLabelText('transactions.form.amount')).toHaveValue('');
    expect(screen.getByLabelText('transactions.form.date')).toHaveValue(today());
    await waitFor(() => expect(screen.getByLabelText('transactions.form.account')).toHaveFocus());
  });

  it('hides "Salvar e adicionar outro" and titles itself "Editar lançamento" in edit mode', () => {
    renderDialog(vi.fn(), makeTransaction());

    expect(screen.queryByRole('button', { name: 'transactions.form.saveAndAddAnother' })).not.toBeInTheDocument();
    expect(screen.getByText('transactions.form.editTitle')).toBeInTheDocument();
  });

  it('shows "Salvar e adicionar outro" and titles itself "Novo lançamento" in create mode', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'transactions.form.saveAndAddAnother' })).toBeInTheDocument();
    expect(screen.getByText('transactions.form.title')).toBeInTheDocument();
  });

  it('treats Enter as Save after a failed save-and-add request', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderDialog(onOpenChange);

    await fillExpense(user);
    await user.click(screen.getByRole('button', { name: 'transactions.form.saveAndAddAnother' }));
    act(() => mutationOptions?.mutation.onError(new Error('Network Error'), undefined, undefined));
    await user.click(screen.getByLabelText('transactions.form.description'));
    await user.keyboard('{Enter}');
    act(() => mutationOptions?.mutation.onSuccess());

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toasts a non-field mutation error', () => {
    renderDialog();

    act(() => mutationOptions?.mutation.onError(new Error('Network Error'), undefined, undefined));

    expect(toastError).toHaveBeenCalledWith('errors.UNKNOWN');
  });

  it('inserts optimistically and restores the list when the request fails', async () => {
    const { queryClient } = renderDialog();
    const key = getListTransactionsQueryKey({ referenceMonth: '2026-08-01', limit: 30 });
    const previous = { pages: [{ items: [], total: 0, incomeTotal: 0, expenseTotal: 0 }], pageParams: [] };
    queryClient.setQueryData(key, previous);
    const data = {
      type: 'EXPENSE' as const,
      amount: 1000,
      date: '2026-08-15',
      description: 'Groceries',
      notes: 'Pantry restock',
      isCreditCard: false,
      accountId: 'account-1',
      categoryId: 'category-1',
      subcategoryId: 'subcategory-1',
    };

    const context = await mutationOptions?.mutation.onMutate({ data });
    const optimistic = queryClient.getQueryData<{ pages: { items: { description: string; notes: string | null }[] }[] }>(key);
    expect(optimistic?.pages[0]?.items[0]).toMatchObject({ description: 'Groceries', notes: 'Pantry restock' });

    act(() => mutationOptions?.mutation.onError(new Error('Network Error'), { data }, context));
    expect(queryClient.getQueryData(key)).toEqual(previous);
  });

  it.each([
    ['TRANSACTION_SAME_ACCOUNT', 'transactions.form.destinationAccount', 'entry-destination-account-error', true],
    ['TRANSACTION_CATEGORY_KIND_MISMATCH', categoryButtonLabel, 'entry-category-error', false],
    ['TRANSACTION_SUBCATEGORY_PARENT_MISMATCH', subcategoryButtonLabel, 'entry-subcategory-error', false],
  ])('shows translated %s error on its mapped control', async (code, label, errorId, isTransfer) => {
    const { user } = renderDialog();

    if (isTransfer) await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));

    act(() => mutationOptions?.mutation.onError({ response: { data: { code } } }, undefined, undefined));

    const control = screen.getByLabelText(label);
    expect(control).toHaveAttribute('aria-describedby', errorId);
    expect(document.getElementById(errorId)).toHaveTextContent(`errors.${code}`);
    expect(control).toHaveFocus();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while a save is pending', () => {
    mutationState = { isPending: true, error: null };
    const { onOpenChange } = renderDialog();

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('prefills edit mode, locks the transaction type, titles itself for editing, and patches changed fields only', async () => {
    const transaction = makeTransaction({ notes: 'Weekly shop' });
    const onOpenChange = vi.fn();
    const { user } = renderDialog(onOpenChange, transaction);

    expect(listAccountsParams).toEqual({ includeInactive: true });
    expect(screen.getByText('transactions.form.editTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.form.description')).toHaveValue('Groceries');
    expect(screen.getByLabelText('transactions.form.notes')).toHaveValue('Weekly shop');
    expect(screen.getByLabelText('transactions.form.amount')).toHaveValue('10,00 €');
    expect(screen.getByRole('tab', { name: 'transactions.form.income' })).toBeDisabled();
    await user.clear(screen.getByLabelText('transactions.form.description'));
    await user.type(screen.getByLabelText('transactions.form.description'), 'Updated groceries');
    await user.clear(screen.getByLabelText('transactions.form.notes'));
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(updateMutate).toHaveBeenCalledWith({ id: 'transaction-1', data: { description: 'Updated groceries', notes: null } });
    expect(mutate).not.toHaveBeenCalled();
    act(() => updateMutationOptions?.mutation.onSuccess());
    expect(toastSuccess).toHaveBeenCalledWith('transactions.form.save');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('leaves the amount field blank for an amountless DRAFT and allows saving other fields with it still empty (ADR-0020)', async () => {
    const transaction = makeTransaction({ status: 'DRAFT', amount: null });
    const { user } = renderDialog(vi.fn(), transaction);

    expect(screen.getByLabelText('transactions.form.amount')).toHaveValue('');
    await user.clear(screen.getByLabelText('transactions.form.description'));
    await user.type(screen.getByLabelText('transactions.form.description'), 'Electricity bill');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(screen.queryByText('transactions.form.invalidAmount')).not.toBeInTheDocument();
    expect(updateMutate).toHaveBeenCalledWith({ id: 'transaction-1', data: { description: 'Electricity bill' } });
  });

  it('fills in the amount on an amountless DRAFT and sends it as a patch', async () => {
    const transaction = makeTransaction({ status: 'DRAFT', amount: null });
    const { user } = renderDialog(vi.fn(), transaction);

    await user.type(screen.getByLabelText('transactions.form.amount'), '42');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(updateMutate).toHaveBeenCalledWith({ id: 'transaction-1', data: { amount: 4200 } });
  });

  it('still requires a positive amount when editing an already-CONFIRMED transaction', async () => {
    const { user } = renderDialog(vi.fn(), makeTransaction({ status: 'CONFIRMED' }));

    await user.clear(screen.getByLabelText('transactions.form.amount'));
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(await screen.findByText('transactions.form.invalidAmount')).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('keeps the edit dialog open and shows a toast when update fails', () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange, makeTransaction());

    act(() => updateMutationOptions?.mutation.onError(new Error('Network Error'), undefined, undefined));
    expect(toastError).toHaveBeenCalledWith('errors.UNKNOWN');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('preserves the stored reference month when an existing transaction date changes', async () => {
    const { user } = renderDialog(vi.fn(), makeTransaction({ referenceMonth: '2026-12-01', isCreditCard: true }));

    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-12');
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-09-15' } });
    await waitFor(() => expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-12'));
    await user.clear(screen.getByLabelText('transactions.form.referenceMonth'));
    await user.type(screen.getByLabelText('transactions.form.referenceMonth'), '2026-11');
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-10-15' } });
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-11');
  });

  it('sends the stored reference month with an edited ordinary entry date', async () => {
    const { user } = renderDialog(vi.fn(), makeTransaction({ referenceMonth: '2026-12-01' }));

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-09-15' } });
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    expect(updateMutate).toHaveBeenCalledWith({ id: 'transaction-1', data: { date: '2026-09-15', referenceMonth: '2026-12-01' } });
  });
});

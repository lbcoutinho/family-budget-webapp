import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { businessCodeField, EntryDialog, suggestedReferenceMonth } from './entry-dialog';

import type * as ApiClient from '@family-budget/api-client';

const categoryButtonLabel = 'choose category';
const subcategoryButtonLabel = 'choose subcategory';
const mutate = vi.fn<(variables: { data: ApiClient.CreateTransactionDto }) => void>();
interface MutationOptions {
  mutation: {
    onError: (error: unknown, variables: unknown, context: unknown) => void;
    onSuccess: () => void;
  };
}
let mutationOptions: MutationOptions | undefined;
let mutationState: { isPending: boolean; error: unknown };
let accounts = [
  { id: 'account-1', name: 'Main account' },
  { id: 'account-2', name: 'Savings' },
];

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@family-budget/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    useListAccounts: () => ({ data: accounts }),
    useCreateTransaction: (options: unknown) => {
      mutationOptions = options as MutationOptions;
      return { mutate, ...mutationState };
    },
  };
});
vi.mock('./category-select', () => ({
  CategorySelect: ({
    categoryId,
    subcategoryId,
    onChange,
    categoryDescribedBy,
    subcategoryDescribedBy,
    categoryInvalid,
    subcategoryInvalid,
  }: {
    categoryId?: string;
    subcategoryId?: string;
    onChange: (categoryId: string, subcategoryId: string) => void;
    categoryDescribedBy?: string;
    subcategoryDescribedBy?: string;
    categoryInvalid?: boolean;
    subcategoryInvalid?: boolean;
  }) => (
    <div>
      <label htmlFor="mock-category">{categoryButtonLabel}</label>
      <select
        id="mock-category"
        value={categoryId ?? ''}
        aria-describedby={categoryDescribedBy}
        aria-invalid={categoryInvalid}
        onChange={(event) => onChange(event.currentTarget.value, 'subcategory-1')}
      >
        <option value="">{categoryButtonLabel}</option>
        <option value="category-1">{categoryButtonLabel}</option>
      </select>
      <output data-testid="selected-category">{categoryId}</output>
      <label htmlFor="mock-subcategory">{subcategoryButtonLabel}</label>
      <select
        id="mock-subcategory"
        value={subcategoryId ?? ''}
        aria-describedby={subcategoryDescribedBy}
        aria-invalid={subcategoryInvalid}
        onChange={(event) => onChange(categoryId ?? 'category-1', event.currentTarget.value)}
      >
        <option value="">{subcategoryButtonLabel}</option>
        <option value="subcategory-1">{subcategoryButtonLabel}</option>
      </select>
      <output data-testid="selected-subcategory">{subcategoryId}</output>
    </div>
  ),
}));

function renderDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EntryDialog open onOpenChange={onOpenChange} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    onOpenChange,
  };
}

async function fillExpense(user: ReturnType<typeof userEvent.setup>, amount = '10') {
  await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
  await user.selectOptions(screen.getByLabelText(categoryButtonLabel), 'category-1');
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
    mutationOptions = undefined;
    mutationState = { isPending: false, error: null };
    accounts = [
      { id: 'account-1', name: 'Main account' },
      { id: 'account-2', name: 'Savings' },
    ];
  });

  it('links to Accounts when none exist', () => {
    accounts = [];
    renderDialog();

    expect(screen.getByRole('link', { name: 'transactions.form.createAccount' })).toHaveAttribute('href', '/accounts');
  });

  it('marks required controls and associates their errors', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    const requiredErrors = [
      ['transactions.form.date', 'entry-date-error'],
      ['transactions.form.account', 'entry-account-error'],
      ['transactions.form.description', 'entry-description-error'],
    ] as const;
    for (const [label, errorId] of requiredErrors) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(errorId)).toHaveTextContent('transactions.form.required');
    }
    expect(screen.getByLabelText('transactions.form.amount')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById('entry-amount-error')).toHaveTextContent('transactions.form.invalidAmount');
    expect(screen.getByLabelText(categoryButtonLabel)).toHaveAttribute('aria-describedby', 'entry-category-error');
    expect(screen.getByLabelText(subcategoryButtonLabel)).toHaveAttribute('aria-describedby', 'entry-subcategory-error');
    expect(screen.getByLabelText(categoryButtonLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(subcategoryButtonLabel)).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['1.234,56', 123456],
    ['1234.56', 123456],
  ])('submits %s as %i cents', async (amount, cents) => {
    const { user } = renderDialog();

    await fillExpense(user, amount);
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    const saved = mutate.mock.calls[0]?.[0].data;
    expect(saved).toMatchObject({
      type: 'EXPENSE',
      amount: cents,
      accountId: 'account-1',
      categoryId: 'category-1',
      subcategoryId: 'subcategory-1',
      description: 'Groceries',
      isCreditCard: false,
    });
    expect(saved).not.toHaveProperty('referenceMonth');
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

  it('suggests and clears the credit-card reference month', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2027-01');
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2027-01-10' } });
    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2027-02');
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    expect(screen.queryByLabelText('transactions.form.referenceMonth')).not.toBeInTheDocument();
  });

  it('keeps an overridden credit-card reference month after the date changes', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByLabelText('transactions.form.creditCard'));
    fireEvent.change(screen.getByLabelText('transactions.form.referenceMonth'), { target: { value: '2026-10' } });
    fireEvent.change(screen.getByLabelText('transactions.form.date'), { target: { value: '2027-01-10' } });

    expect(screen.getByLabelText('transactions.form.referenceMonth')).toHaveValue('2026-10');
  });

  it('keeps entry context, clears entry-specific fields, and focuses description after save and add another', async () => {
    const { user } = renderDialog();

    await fillExpense(user);
    await user.click(screen.getByRole('button', { name: 'transactions.form.saveAndAddAnother' }));
    act(() => mutationOptions?.mutation.onSuccess());

    expect(screen.getByLabelText('transactions.form.account')).toHaveValue('account-1');
    expect(screen.getByTestId('selected-category')).toHaveTextContent('category-1');
    expect(screen.getByLabelText('transactions.form.description')).toHaveValue('');
    expect(screen.getByLabelText('transactions.form.amount')).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('transactions.form.description')).toHaveFocus());
  });

  it.each([
    ['TRANSACTION_SAME_ACCOUNT', 'transactions.form.destinationAccount', 'entry-destination-account-error', true],
    ['TRANSACTION_CATEGORY_KIND_MISMATCH', categoryButtonLabel, 'entry-category-error', false],
    ['TRANSACTION_SUBCATEGORY_PARENT_MISMATCH', subcategoryButtonLabel, 'entry-subcategory-error', false],
  ])('shows translated %s error on its mapped control', async (code, label, errorId, isTransfer) => {
    mutationState = { isPending: false, error: { response: { data: { code } } } };
    const { user } = renderDialog();

    if (isTransfer) await user.click(screen.getByRole('tab', { name: 'transactions.form.transfer' }));

    act(() => mutationOptions?.mutation.onError({ response: { data: { code } } }, undefined, undefined));

    expect(screen.getByRole('alert')).toHaveTextContent(`errors.${code}`);
    const control = screen.getByLabelText(label);
    expect(control).toHaveAttribute('aria-describedby', errorId);
    expect(document.getElementById(errorId)).toHaveTextContent(`errors.${code}`);
  });

  it('cannot be dismissed while a save is pending', () => {
    mutationState = { isPending: true, error: null };
    const { onOpenChange } = renderDialog();

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { businessCodeField, EntryDialog, suggestedReferenceMonth } from './entry-dialog';

import type * as ApiClient from '@family-budget/api-client';

const categoryButtonLabel = 'choose category';
const mutate = vi.fn<(variables: { data: ApiClient.CreateTransactionDto }) => void>();

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@family-budget/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    useListAccounts: () => ({
      data: [
        { id: 'account-1', name: 'Main account' },
        { id: 'account-2', name: 'Savings' },
      ],
    }),
    useCreateTransaction: () => ({ mutate, isPending: false, error: null }),
  };
});
vi.mock('./category-select', () => ({
  CategorySelect: ({ onChange }: { onChange: (categoryId: string, subcategoryId: string) => void }) => (
    <button type="button" onClick={() => onChange('category-1', 'subcategory-1')}>
      {categoryButtonLabel}
    </button>
  ),
}));

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <EntryDialog open onOpenChange={() => undefined} />
      </QueryClientProvider>,
    ),
  };
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
  beforeEach(() => mutate.mockClear());

  it('submits an expense in cents with no reference month by default', async () => {
    const { user } = renderDialog();

    await user.selectOptions(screen.getByLabelText('transactions.form.account'), 'account-1');
    await user.click(screen.getByRole('button', { name: categoryButtonLabel }));
    await user.type(screen.getByLabelText('transactions.form.description'), 'Groceries');
    await user.type(screen.getByLabelText('transactions.form.amount'), '1.234,56');
    await user.click(screen.getByRole('button', { name: 'transactions.form.save' }));

    const saved = mutate.mock.calls[0]?.[0].data;
    expect(saved).toMatchObject({
      type: 'EXPENSE',
      amount: 123456,
      accountId: 'account-1',
      categoryId: 'category-1',
      subcategoryId: 'subcategory-1',
      description: 'Groceries',
      isCreditCard: false,
    });
    expect(saved).not.toHaveProperty('referenceMonth');
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
});

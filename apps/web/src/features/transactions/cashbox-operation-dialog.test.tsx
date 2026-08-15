import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CashboxOperationDialog, cashboxOperationPayload } from './cashbox-operation-dialog';

import type * as ApiClient from '@family-budget/api-client';

const mutate = vi.fn<(variables: { data: ApiClient.CreateTransactionDto }) => void>();
const updateMutate = vi.fn<(variables: { id: string; data: ApiClient.UpdateTransactionDto }) => void>();
interface MutationOptions {
  mutation: {
    onError: (error: unknown, variables: unknown, context: unknown) => void;
    onSuccess: () => void;
  };
}
let mutationOptions: MutationOptions | undefined;
let mutationState: { isPending: boolean; error: unknown };
let accounts = [
  { id: 'account-1', name: 'Conta principal', isActive: true },
  { id: 'account-2', name: 'Poupança', isActive: true },
];
let cashboxes = [
  { id: 'cashbox-1', name: 'Férias', isActive: true },
  { id: 'cashbox-2', name: 'Obras', isActive: true },
];
let cashboxListParams: unknown;
let accountBalances = [
  { accountId: 'account-1', name: 'Conta principal', balance: 200000 },
  { accountId: 'account-2', name: 'Poupança', balance: 300000 },
];
let cashboxBalances = [
  { cashboxId: 'cashbox-1', name: 'Férias', balance: 100000 },
  { cashboxId: 'cashbox-2', name: 'Obras', balance: 50000 },
];

vi.mock('@family-budget/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    useListAccounts: () => ({ data: accounts }),
    useListCashboxes: (params: unknown) => {
      cashboxListParams = params;
      return { data: cashboxes };
    },
    useListAccountBalances: () => ({ data: accountBalances }),
    useListCashboxBalances: () => ({ data: cashboxBalances }),
    useCreateTransaction: (options: unknown) => {
      mutationOptions = options as MutationOptions;
      return { mutate, ...mutationState };
    },
    useUpdateTransaction: (options: unknown) => {
      mutationOptions = options as MutationOptions;
      return { mutate: updateMutate, ...mutationState };
    },
  };
});

function renderDialog(onOpenChange = vi.fn(), transaction?: ApiClient.TransactionListItemDto) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    user: userEvent.setup(),
    onOpenChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CashboxOperationDialog open onOpenChange={onOpenChange} transaction={transaction} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

async function fillCommon(user: ReturnType<typeof userEvent.setup>, amount = '1.234,56') {
  await user.clear(screen.getByLabelText('Descrição'));
  await user.type(screen.getByLabelText('Descrição'), 'Fundo de férias');
  await user.type(screen.getByLabelText('Valor'), amount);
}

describe('cashbox operation payloads', () => {
  const values = {
    accountId: 'account-1',
    cashboxId: 'cashbox-1',
    destinationCashboxId: 'cashbox-2',
    amount: 123456,
    date: '2026-08-15',
    description: 'Fund holiday',
  };

  it.each([
    ['deposit', { type: 'CASHBOX_IN', accountId: 'account-1', cashboxId: 'cashbox-1' }],
    ['withdrawal', { type: 'CASHBOX_OUT', accountId: 'account-1', cashboxId: 'cashbox-1' }],
    ['transfer', { type: 'CASHBOX_TRANSFER', cashboxId: 'cashbox-1', destinationCashboxId: 'cashbox-2' }],
  ] as const)('creates the allowed fields for %s', (mode, references) => {
    expect(cashboxOperationPayload(mode, values)).toEqual({ amount: 123456, date: '2026-08-15', description: 'Fund holiday', ...references });
  });
});

describe('CashboxOperationDialog', () => {
  beforeEach(() => {
    mutate.mockClear();
    updateMutate.mockClear();
    mutationOptions = undefined;
    mutationState = { isPending: false, error: null };
    accounts = [
      { id: 'account-1', name: 'Conta principal', isActive: true },
      { id: 'account-2', name: 'Poupança', isActive: true },
    ];
    cashboxes = [
      { id: 'cashbox-1', name: 'Férias', isActive: true },
      { id: 'cashbox-2', name: 'Obras', isActive: true },
    ];
    cashboxListParams = undefined;
    accountBalances = [
      { accountId: 'account-1', name: 'Conta principal', balance: 200000 },
      { accountId: 'account-2', name: 'Poupança', balance: 300000 },
    ];
    cashboxBalances = [
      { cashboxId: 'cashbox-1', name: 'Férias', balance: 100000 },
      { cashboxId: 'cashbox-2', name: 'Obras', balance: 50000 },
    ];
  });

  it('submits a deposit without forbidden fields', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-08-15' } });
    await user.selectOptions(screen.getByLabelText('Conta de origem'), 'account-1');
    await user.selectOptions(screen.getByLabelText('Caixinha de destino'), 'cashbox-1');
    await fillCommon(user);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mutate).toHaveBeenCalledWith({
      data: { type: 'CASHBOX_IN', accountId: 'account-1', cashboxId: 'cashbox-1', amount: 123456, date: '2026-08-15', description: 'Fundo de férias' },
    });
  });

  it('updates an existing operation with only changed fields and keeps its type immutable', async () => {
    const transaction = {
      id: 'transaction-1',
      type: 'CASHBOX_IN',
      status: 'CONFIRMED',
      source: 'MANUAL',
      amount: 1000,
      date: '2026-08-15',
      referenceMonth: '2026-08-01',
      description: 'Old deposit',
      notes: null,
      isCreditCard: false,
      accountId: 'account-1',
      destinationAccountId: null,
      categoryId: null,
      subcategoryId: null,
      cashboxId: 'cashbox-1',
      destinationCashboxId: null,
      cashboxLabel: 'Férias',
      destinationCashboxLabel: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      account: { id: 'account-1', name: 'Conta principal' },
      category: null,
      subcategory: null,
    } as ApiClient.TransactionListItemDto;
    const { user, onOpenChange } = renderDialog(vi.fn(), transaction);

    await user.clear(screen.getByLabelText('Descrição'));
    await user.type(screen.getByLabelText('Descrição'), 'Updated deposit');
    await user.clear(screen.getByLabelText('Valor'));
    await user.type(screen.getByLabelText('Valor'), '20');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(updateMutate).toHaveBeenCalledWith({ id: 'transaction-1', data: { amount: 2000, description: 'Updated deposit' } });
    expect(updateMutate.mock.calls[0]?.[0]?.data).not.toHaveProperty('type');

    act(() => mutationOptions?.mutation.onSuccess());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps edit mode open and shows the API error when updating fails', async () => {
    const transaction = {
      id: 'transaction-1',
      type: 'CASHBOX_OUT',
      status: 'CONFIRMED',
      source: 'MANUAL',
      amount: 1000,
      date: '2026-08-15',
      referenceMonth: '2026-08-01',
      description: 'Old withdrawal',
      notes: null,
      isCreditCard: false,
      accountId: 'account-1',
      destinationAccountId: null,
      categoryId: null,
      subcategoryId: null,
      cashboxId: 'cashbox-1',
      destinationCashboxId: null,
      cashboxLabel: 'Férias',
      destinationCashboxLabel: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      account: { id: 'account-1', name: 'Conta principal' },
      category: null,
      subcategory: null,
    } as ApiClient.TransactionListItemDto;
    const { user, onOpenChange } = renderDialog(vi.fn(), transaction);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    act(() => mutationOptions?.mutation.onError(new Error('nope'), undefined, undefined));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it.each([
    ['Retirar', 'CASHBOX_OUT', 'Conta de destino', { accountId: 'account-1', cashboxId: 'cashbox-1' }],
    ['Transferir', 'CASHBOX_TRANSFER', undefined, { cashboxId: 'cashbox-1', destinationCashboxId: 'cashbox-2' }],
  ] as const)('submits %s with only its allowed references', async (tab, type, accountLabel, references) => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('tab', { name: tab }));
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-08-15' } });
    await user.selectOptions(screen.getByLabelText('Caixinha de origem'), 'cashbox-1');
    if (accountLabel) await user.selectOptions(screen.getByLabelText(accountLabel), 'account-1');
    else await user.selectOptions(screen.getByLabelText('Caixinha de destino'), 'cashbox-2');
    await fillCommon(user, '20');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const saved = mutate.mock.calls[0]?.[0]?.data;
    expect(saved).toEqual({ type, ...references, amount: 2000, date: '2026-08-15', description: 'Fundo de férias' });
  });

  it('shows the selected balance beside both selectors', async () => {
    const { user } = renderDialog();

    await user.selectOptions(screen.getByLabelText('Conta de origem'), 'account-1');
    await user.selectOptions(screen.getByLabelText('Caixinha de destino'), 'cashbox-1');

    expect(screen.getByText('2.000,00 €')).toBeInTheDocument();
    expect(screen.getByText('1.000,00 €')).toBeInTheDocument();
  });

  it('keeps transfer available without accounts and disables it with fewer than two cashboxes', async () => {
    accounts = [];
    const { user, unmount } = renderDialog();

    expect(screen.getByRole('tab', { name: 'Depositar' })).toHaveAttribute('data-state', 'active');
    await user.click(screen.getByRole('tab', { name: 'Transferir' }));
    expect(screen.queryByLabelText('Conta de origem')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Caixinha de origem'), 'cashbox-1');
    await user.selectOptions(screen.getByLabelText('Caixinha de destino'), 'cashbox-2');
    unmount();

    accounts = [{ id: 'account-1', name: 'Conta principal', isActive: true }];
    cashboxes = [{ id: 'cashbox-1', name: 'Férias', isActive: true }];
    renderDialog();

    expect(screen.getByRole('tab', { name: 'Transferir' })).toBeDisabled();
    expect(screen.getByText('Crie pelo menos duas caixinhas ativas para transferir entre elas.')).toBeInTheDocument();
  });

  it('excludes inactive accounts and cashboxes from selectors', () => {
    accounts = [...accounts, { id: 'account-inactive', name: 'Conta encerrada', isActive: false }];
    cashboxes = [...cashboxes, { id: 'cashbox-inactive', name: 'Caixinha encerrada', isActive: false }];
    renderDialog();

    expect(screen.queryByRole('option', { name: 'Conta encerrada' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Caixinha encerrada' })).not.toBeInTheDocument();
  });

  it('keeps both inactive cashboxes visible when editing a transfer', () => {
    cashboxes = [
      { id: 'cashbox-1', name: 'Férias', isActive: false },
      { id: 'cashbox-2', name: 'Obras', isActive: false },
    ];
    const transaction = {
      id: 'transaction-1',
      type: 'CASHBOX_TRANSFER',
      status: 'CONFIRMED',
      source: 'MANUAL',
      amount: 1000,
      date: '2026-08-15',
      referenceMonth: '2026-08-01',
      description: 'Old transfer',
      notes: null,
      isCreditCard: false,
      accountId: null,
      destinationAccountId: null,
      categoryId: null,
      subcategoryId: null,
      cashboxId: 'cashbox-1',
      destinationCashboxId: 'cashbox-2',
      cashboxLabel: 'Férias',
      destinationCashboxLabel: 'Obras',
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      account: null,
      category: null,
      subcategory: null,
    } as ApiClient.TransactionListItemDto;

    renderDialog(vi.fn(), transaction);

    expect(cashboxListParams).toEqual({ includeInactive: true });
    expect(screen.getAllByRole('option', { name: 'Férias (inativa)' })).toHaveLength(2);
    expect(screen.getAllByRole('option', { name: 'Obras (inativa)' })).toHaveLength(2);
  });

  it('shows the approved explanatory callouts for deposits and transfers', async () => {
    const { user } = renderDialog();

    expect(screen.getByText('O dinheiro sai da conta e fica guardado na caixinha. Não conta como despesa em relatório nenhum.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Transferir' }));
    expect(screen.getByText('Transfira saldo de uma caixinha para outra — a poupança não sai de circulação, só muda de nome.')).toBeInTheDocument();
  });

  it('warns only on submit when a cashbox withdrawal exceeds its balance without blocking the request', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('tab', { name: 'Retirar' }));
    await user.selectOptions(screen.getByLabelText('Caixinha de origem'), 'cashbox-1');
    await user.selectOptions(screen.getByLabelText('Conta de destino'), 'account-1');
    await fillCommon(user, '1.000,01');
    expect(screen.queryByText(/Saldo da caixinha:/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText(/Saldo da caixinha: 1.000,00 €/)).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledOnce();

    await user.selectOptions(screen.getByLabelText('Caixinha de origem'), 'cashbox-2');
    expect(screen.queryByText(/Saldo da caixinha:/)).not.toBeInTheDocument();
  });

  it('rejects a transfer to the same cashbox before mutation', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('tab', { name: 'Transferir' }));
    await user.selectOptions(screen.getByLabelText('Caixinha de origem'), 'cashbox-1');
    await user.selectOptions(screen.getByLabelText('Caixinha de destino'), 'cashbox-1');
    await fillCommon(user, '20');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByLabelText('Caixinha de destino')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('As caixinhas de origem e destino precisam ser diferentes.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('renders the available balance from a cashbox insufficient-funds response', () => {
    renderDialog();

    act(() =>
      mutationOptions?.mutation.onError(
        { response: { data: { code: 'CASHBOX_INSUFFICIENT_FUNDS', message: 'available balance: 5000 cents' } } },
        undefined,
        undefined,
      ),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Saldo disponível na caixinha: 50,00 €.');
  });

  it('clears operation references and warning when switching mode while preserving common values', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-08-15' } });
    await user.selectOptions(screen.getByLabelText('Conta de origem'), 'account-1');
    await user.selectOptions(screen.getByLabelText('Caixinha de destino'), 'cashbox-1');
    await fillCommon(user, '1.000,01');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    await user.click(screen.getByRole('tab', { name: 'Retirar' }));

    expect(screen.getByLabelText('Caixinha de origem')).toHaveValue('');
    expect(screen.getByLabelText('Conta de destino')).toHaveValue('');
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-15');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Fundo de férias');
    expect(screen.getByLabelText('Valor')).toHaveValue('1.000,01 €');
    expect(screen.queryByText(/Saldo da caixinha:/)).not.toBeInTheDocument();
  });

  it('shows a deleted cashbox snapshot and requires a live replacement', async () => {
    const transaction = {
      id: 'transaction-1',
      type: 'CASHBOX_OUT',
      status: 'CONFIRMED',
      source: 'MANUAL',
      amount: 1000,
      date: '2026-08-15',
      referenceMonth: '2026-08-01',
      description: 'Old withdrawal',
      notes: null,
      isCreditCard: false,
      accountId: 'account-1',
      destinationAccountId: null,
      categoryId: null,
      subcategoryId: null,
      cashboxId: null,
      destinationCashboxId: null,
      cashboxLabel: 'Cashbox antiga',
      destinationCashboxLabel: null,
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
      account: { id: 'account-1', name: 'Conta principal' },
      category: null,
      subcategory: null,
    } as ApiClient.TransactionListItemDto;
    const { user } = renderDialog(vi.fn(), transaction);

    expect(screen.getByText('Cashbox antiga')).toBeInTheDocument();
    expect(screen.getByText('(caixinha excluída)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByLabelText('Caixinha (nova)')).toHaveAttribute('aria-invalid', 'true');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('marks missing amount, date, and description without saving', async () => {
    const { user } = renderDialog();

    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    for (const label of ['Data', 'Descrição', 'Valor']) expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while a save is pending', () => {
    mutationState = { isPending: true, error: null };
    const { onOpenChange } = renderDialog();

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

import { type AccountDto, type CategoryDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecurrenceDialog } from './recurrence-dialog';

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

const SUBCATEGORY: CategoryDto = {
  id: 'sub-1',
  parentId: 'cat-1',
  name: 'Renda',
  kind: 'EXPENSE',
  color: null,
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
  children: [SUBCATEGORY],
};

const INCOME_SUBCATEGORY: CategoryDto = {
  id: 'sub-2',
  parentId: 'cat-2',
  name: 'Salário',
  kind: 'INCOME',
  color: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const INCOME_CATEGORY: CategoryDto = {
  id: 'cat-2',
  parentId: null,
  name: 'Trabalho',
  kind: 'INCOME',
  color: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  children: [INCOME_SUBCATEGORY],
};

function renderDialog(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    onSubmit,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RecurrenceDialog open onOpenChange={() => undefined} isPending={false} error={undefined} onSubmit={onSubmit} />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: 'Millennium' });
  await user.selectOptions(screen.getByLabelText('Conta'), 'Millennium');

  await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
  await user.click(await screen.findByRole('option', { name: 'Moradia' }));
  await user.click(screen.getByRole('combobox', { name: 'Subcategoria' }));
  await user.click(await screen.findByRole('option', { name: 'Renda' }));

  await user.type(screen.getByLabelText('Descrição'), 'Renda');
  await user.type(screen.getByLabelText('Valor'), '950,00');
  await user.type(screen.getByLabelText('Início'), '2026-08');
}

describe('RecurrenceDialog', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACCOUNT])),
      http.get('/api/categories', () => HttpResponse.json([CATEGORY, INCOME_CATEGORY])),
      http.post('/api/recurrence-rules/preview', () => HttpResponse.json({ occurrences: ['2026-08-01', '2026-09-01', '2026-10-01'] })),
    );
  });

  it('blocks Save until the preview for the current fields has loaded', async () => {
    const { user } = renderDialog();

    await fillValidForm(user);

    const saveButton = screen.getByRole('button', { name: 'Salvar' });
    expect(saveButton).toBeDisabled();

    await waitFor(() => expect(saveButton).toBeEnabled(), { timeout: 3000 });
    expect(await screen.findByText('01/08/2026')).toBeInTheDocument();
  });

  it('rejects a day of month outside 1-31', async () => {
    const { user, onSubmit } = renderDialog();

    await fillValidForm(user);
    const day = screen.getByLabelText('Dia do mês');
    await user.clear(day);
    await user.type(day, '32');
    await user.tab();

    expect(await screen.findByText('O dia deve ser entre 1 e 31.')).toBeInTheDocument();
    expect(day).toHaveAttribute('aria-invalid', 'true');
    expect(day).toHaveAttribute('aria-describedby', 'rule-day-error');
    expect(document.getElementById('rule-day-error')).toHaveTextContent('O dia deve ser entre 1 e 31.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('associates each required-field error with its recurrence control', () => {
    const { container } = renderDialog();

    fireEvent.submit(container.querySelector('form')!);

    for (const [label, errorId] of [
      ['Conta', 'rule-account-error'],
      ['Categoria', 'rule-category-error'],
      ['Subcategoria', 'rule-subcategory-error'],
      ['Descrição', 'rule-description-error'],
      ['Valor', 'rule-amount-error'],
      ['Início', 'rule-start-error'],
    ]) {
      const control = screen.getByLabelText(label);
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAttribute('aria-describedby', errorId);
      expect(document.getElementById(errorId)).not.toBeNull();
    }
  });

  it('rejects an end month before the start month', async () => {
    const { user, onSubmit } = renderDialog();

    await fillValidForm(user);
    await user.type(screen.getByLabelText('Fim'), '2026-01');
    await user.tab();

    expect(await screen.findByText('O fim não pode ser antes do início.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the category/subcategory form value when switching between Despesa and Receita, not just the visible label', async () => {
    const { user, onSubmit } = renderDialog();

    // Without a reset, `categoryId` would silently keep pointing at Moradia (EXPENSE) after the
    // switch — invisible in the trigger (`CategorySelect` filters its roots by kind, so nothing
    // matches and it renders the placeholder) but still non-empty, so a submit right after
    // switching — before touching the category field again — would sail through validation and
    // send a category whose kind no longer matches the rule's type.
    await fillValidForm(user);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled(), { timeout: 3000 });

    await user.click(screen.getByRole('tab', { name: 'Receita' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Preencha este campo.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the typed amount as integer cents once the preview is ready', async () => {
    const { user, onSubmit } = renderDialog();

    await fillValidForm(user);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled(), { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 95000, dayOfMonth: 1, startDate: '2026-08-01' }));
  });

  it('allows a blank amount once autoConfirm is switched off', async () => {
    const { user, onSubmit } = renderDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole('switch', { name: 'Confirmar automaticamente' }));
    await user.clear(screen.getByLabelText('Valor'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled(), { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: null, autoConfirm: false }));
  });

  it('surfaces a server error', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RecurrenceDialog
            open
            onOpenChange={() => undefined}
            isPending={false}
            error={{ response: { data: { code: 'VALIDATION_ERROR' } } }}
            onSubmit={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

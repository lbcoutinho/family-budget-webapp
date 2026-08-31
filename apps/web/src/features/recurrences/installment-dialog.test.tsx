import { type AccountDto, type CategoryDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallmentDialog } from './installment-dialog';

import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test/server';

const ACCOUNT: AccountDto = {
  id: 'acc-1',
  name: 'Revolut',
  initialBalance: 0,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SUBCATEGORY: CategoryDto = {
  id: 'sub-1',
  parentId: 'cat-1',
  name: 'Móveis',
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
  name: 'Outros',
  kind: 'EXPENSE',
  color: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  children: [SUBCATEGORY],
};

function renderDialog(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    onSubmit,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <InstallmentDialog open onOpenChange={() => undefined} isPending={false} error={undefined} onSubmit={onSubmit} />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: 'Revolut' });
  await user.selectOptions(screen.getByLabelText('Conta'), 'Revolut');
  await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
  await user.click(await screen.findByRole('option', { name: 'Outros' }));
  await user.click(screen.getByRole('combobox', { name: 'Subcategoria' }));
  await user.click(await screen.findByRole('option', { name: 'Móveis' }));
  await user.type(screen.getByLabelText('Descrição'), 'Colchão Ikea');
}

describe('InstallmentDialog', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACCOUNT])),
      http.get('/api/categories', () => HttpResponse.json([CATEGORY])),
    );
  });

  it('shows the division remainder on the last installment', async () => {
    const { user } = renderDialog();

    await fillValidForm(user);
    await user.type(screen.getByLabelText('Valor total'), '100,00');
    await user.clear(screen.getByLabelText('Parcelas'));
    await user.type(screen.getByLabelText('Parcelas'), '3');

    // Two of the three installments land on the same base amount (33,33 €) — only the last one
    // absorbs the remainder (33,34 €), so the first assertion expects two matches, not one.
    expect(await screen.findAllByText(/33,33 €/)).toHaveLength(2);
    expect(screen.getByText(/33,34 €/)).toBeInTheDocument();
    expect(screen.getByText(/A última parcela leva/)).toBeInTheDocument();
  }, 10000);

  it('rejects fewer than 2 installments', async () => {
    const { user } = renderDialog();

    await fillValidForm(user);
    await user.type(screen.getByLabelText('Valor total'), '100,00');
    await user.clear(screen.getByLabelText('Parcelas'));
    await user.type(screen.getByLabelText('Parcelas'), '1');
    await user.tab();

    expect(await screen.findByText('Precisa de ao menos 2 parcelas.')).toBeInTheDocument();
    expect(screen.getByLabelText('Parcelas')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Parcelas')).toHaveAttribute('aria-describedby', 'installment-count-error');
    expect(document.getElementById('installment-count-error')).toHaveTextContent('Precisa de ao menos 2 parcelas.');
  }, 10000);

  it('associates each required-field error with its installment control', () => {
    renderDialog();

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);

    for (const [label, errorId] of [
      ['Conta', 'installment-account-error'],
      ['Categoria', 'installment-category-error'],
      ['Descrição', 'installment-description-error'],
      ['Valor total', 'installment-total-error'],
    ] as const) {
      const control = screen.getByLabelText(label);
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(control).toHaveAttribute('aria-describedby', errorId);
      expect(document.getElementById(errorId)).not.toBeNull();
    }
  });

  it('sends the purchase date and first payment date as separate fields', async () => {
    const { user, onSubmit } = renderDialog();

    await fillValidForm(user);
    await user.type(screen.getByLabelText('Valor total'), '449,00');

    const purchaseDate = screen.getByLabelText('Data da compra');
    await user.clear(purchaseDate);
    await user.type(purchaseDate, '2026-07-22');
    const firstPayment = screen.getByLabelText('Primeira cobrança');
    await user.clear(firstPayment);
    await user.type(firstPayment, '2026-08-05');

    await user.click(screen.getByRole('button', { name: /Criar \d+ parcelas/ }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ purchaseDate: '2026-07-22', firstPaymentDate: '2026-08-05', totalAmount: 44900 }));
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountDialog } from './account-dialog';

import { server } from '@/test/server';

function renderDialog(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    user: userEvent.setup(),
    onSubmit,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AccountDialog open onOpenChange={() => undefined} isPending={false} error={undefined} onSubmit={onSubmit} />
      </QueryClientProvider>,
    ),
  };
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText('Nome'), name);
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
}

describe('AccountDialog', () => {
  beforeEach(() =>
    server.use(
      http.get('/api/financial-institutions', () => HttpResponse.json([])),
      http.get('/api/instruments', () => HttpResponse.json([])),
    ),
  );
  it('posts Instrument Balance inputs without a scalar initial balance', async () => {
    const { user, onSubmit } = renderDialog();

    await user.click(screen.getByLabelText('Tipo de conta'));
    await user.click(screen.getByRole('option', { name: 'Outro' }));
    await fillAndSubmit(user, 'Millennium');

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Millennium', kind: 'OTHER', financialInstitutionId: null, initialBalances: [] });
  });

  it('requires an institution for a bank account', async () => {
    const { user, onSubmit } = renderDialog();

    await fillAndSubmit(user, 'Millennium');

    expect(await screen.findByText('Escolha uma instituição financeira.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers only compatible instruments for the selected account kind', async () => {
    server.use(
      http.get('/api/instruments', () =>
        HttpResponse.json([
          { id: 'eur', name: 'Euro', code: 'EUR', type: 'FIAT' },
          { id: 'btc', name: 'Bitcoin', code: 'BTC', type: 'CRYPTOCURRENCY' },
        ]),
      ),
    );
    const { user } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Adicionar instrumento' }));
    await user.click(screen.getByLabelText('Instrumento'));

    expect(screen.getByRole('option', { name: 'EUR' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'BTC' })).not.toBeInTheDocument();
  });

  it('blocks submit on a blank name, without calling onSubmit', async () => {
    const { user, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe o nome da conta.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('orders Financial Institution, name, Account kind, then Initial Balances', () => {
    renderDialog();

    const institution = screen.getByText('Instituição financeira');
    const name = screen.getByText('Nome');
    const kind = screen.getByText('Tipo de conta');
    const balances = screen.getByText('Saldos iniciais por instrumento');

    expect(institution.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(name.compareDocumentPosition(kind) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(kind.compareDocumentPosition(balances) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

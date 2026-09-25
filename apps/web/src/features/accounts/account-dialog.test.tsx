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

    await fillAndSubmit(user, 'Millennium');

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Millennium', kind: 'BANK', financialInstitutionId: null, initialBalances: [] });
  });

  it('blocks submit on a blank name, without calling onSubmit', async () => {
    const { user, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe o nome da conta.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AccountDialog } from './account-dialog';

function renderDialog(onSubmit = vi.fn()) {
  return {
    user: userEvent.setup(),
    onSubmit,
    ...render(<AccountDialog open onOpenChange={() => undefined} isPending={false} error={undefined} onSubmit={onSubmit} />),
  };
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, name: string, initialBalance: string) {
  await user.type(screen.getByLabelText('Nome'), name);
  await user.clear(screen.getByLabelText('Saldo inicial'));
  await user.type(screen.getByLabelText('Saldo inicial'), initialBalance);
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
}

describe('AccountDialog', () => {
  it('posts 123456 cents for "1.234,56"', async () => {
    const { user, onSubmit } = renderDialog();

    await fillAndSubmit(user, 'Millennium', '1.234,56');

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Millennium', initialBalance: 123456 });
  });

  it('posts 123456 cents for "1234.56"', async () => {
    const { user, onSubmit } = renderDialog();

    await fillAndSubmit(user, 'Millennium', '1234.56');

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Millennium', initialBalance: 123456 });
  });

  it('posts 0 for an empty balance', async () => {
    const { user, onSubmit } = renderDialog();

    await user.type(screen.getByLabelText('Nome'), 'Dinheiro');
    await user.clear(screen.getByLabelText('Saldo inicial'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Dinheiro', initialBalance: 0 });
  });

  it('blocks submit on a blank name, without calling onSubmit', async () => {
    const { user, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe o nome da conta.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the invalid-amount message for garbage input', async () => {
    const { user, onSubmit } = renderDialog();

    await user.type(screen.getByLabelText('Nome'), 'Revolut');
    await user.clear(screen.getByLabelText('Saldo inicial'));
    await user.type(screen.getByLabelText('Saldo inicial'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Informe um valor válido.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn() }));

vi.mock('@family-budget/api-client', () => ({
  usePreviewInvestmentImport: (options: { mutation: { onSuccess: (result: unknown) => void } }) => ({
    mutate: (value: unknown) => {
      api.preview(value);
      options.mutation.onSuccess({
        validRows: 1,
        errors: [],
        warnings: [],
        positions: [
          {
            accountId: 'account',
            accountName: 'Kraken',
            instrumentId: 'btc',
            instrumentCode: 'BTC',
            quantity: '0.01',
            remainingCost: 10000,
            realizedResult: 0,
          },
        ],
        balances: [
          { accountId: 'account', accountName: 'Kraken', instrumentId: 'btc', instrumentCode: 'BTC', quantity: '0.01' },
          { accountId: 'account', accountName: 'Kraken', instrumentId: 'eur', instrumentCode: 'EUR', quantity: '0' },
        ],
      });
    },
    isPending: false,
  }),
  useConfirmInvestmentImport: (options: { mutation: { onSuccess: () => void } }) => ({
    mutate: (value: unknown) => {
      api.confirm(value);
      options.mutation.onSuccess();
    },
    isPending: false,
  }),
}));

import { InvestmentImportPage } from './investment-import-page';

describe('InvestmentImportPage', () => {
  it('confirms only an explicitly reasoned reconciliation adjustment', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <InvestmentImportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.upload(screen.getByLabelText('Escolher arquivo CSV'), new File(['csv'], 'history.csv', { type: 'text/csv' }));
    await user.click(screen.getByRole('button', { name: 'Validar e simular' }));
    await user.click(screen.getByRole('button', { name: 'Continuar para reconciliação' }));

    await user.type(await screen.findByRole('textbox', { name: 'Real BTC' }), '0.02');
    await user.type(screen.getByRole('textbox', { name: 'Motivo BTC' }), 'Saldo conferido na exchange');
    await user.type(screen.getByRole('textbox', { name: 'Custo em EUR BTC' }), '10000');
    await user.type(screen.getByRole('textbox', { name: 'Real EUR' }), '0');
    await user.click(screen.getByRole('button', { name: 'Revisar confirmação' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Confirmar lote de importação' }));

    await screen.findByRole('button', { name: 'Validar e simular' });
    const request = api.confirm.mock.calls[0]?.[0] as { data: { reconciliation: string } };
    expect(JSON.parse(request.data.reconciliation)).toEqual([
      expect.objectContaining({ instrumentId: 'btc', actualQuantity: '0.02', reason: 'Saldo conferido na exchange', cost: 10000 }),
    ]);
  });
});

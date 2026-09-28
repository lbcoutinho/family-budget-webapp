import { type AccountDto, type AccountInstrumentBalanceDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { AccountsPage } from './accounts-page';

import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test/server';

const ACTIVE: AccountDto = {
  id: 'a1',
  name: 'Millennium',
  kind: 'OTHER',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const INACTIVE: AccountDto = {
  id: 'a2',
  name: 'Activobank',
  isActive: false,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AccountsPage />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

const BALANCES: AccountInstrumentBalanceDto[] = [{ accountId: 'a1', instrumentId: 'eur', instrumentName: 'Euro', instrumentCode: 'EUR', quantity: '3482.15' }];

describe('AccountsPage', () => {
  // Every test renders the Instrument balance column, which is backed by its own query — most tests
  // don't care about the actual numbers, only that the request doesn't trip
  // `onUnhandledRequest: 'error'`.
  beforeEach(() => {
    server.use(
      http.get('/api/accounts/instrument-balances', () => HttpResponse.json(BALANCES)),
      http.get('/api/financial-institutions', () => HttpResponse.json([])),
      http.get('/api/instruments', () => HttpResponse.json([])),
    );
  });

  it('shows exact native Instrument balances from the public endpoint', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json([ACTIVE])));

    renderPage();

    expect(await screen.findByText('Millennium')).toBeInTheDocument();
    expect(screen.getByText('3482.15 EUR')).toBeInTheDocument();
  });

  it('shows localized account kinds instead of enum values', async () => {
    server.use(
      http.get('/api/accounts', () =>
        HttpResponse.json([
          { ...ACTIVE, id: 'bank', kind: 'BANK' },
          { ...ACTIVE, id: 'brokerage', kind: 'BROKERAGE' },
          { ...ACTIVE, id: 'exchange', kind: 'EXCHANGE' },
          { ...ACTIVE, id: 'wallet', kind: 'WALLET' },
          { ...ACTIVE, id: 'other', kind: 'OTHER' },
        ]),
      ),
    );

    renderPage();

    expect(await screen.findByText('Banco')).toBeInTheDocument();
    expect(screen.getByText('Corretora')).toBeInTheDocument();
    expect(screen.getByText('Exchange')).toBeInTheDocument();
    expect(screen.getByText('Carteira')).toBeInTheDocument();
    expect(screen.getByText('Outro')).toBeInTheDocument();
  });

  it('marks an institution-less bank account as requiring action, while an Other account stays neutral', async () => {
    server.use(
      http.get('/api/accounts', () =>
        HttpResponse.json([
          { ...ACTIVE, id: 'legacy', kind: 'BANK', financialInstitutionId: null, financialInstitutionName: null },
          { ...ACTIVE, id: 'other', name: 'Cash', kind: 'OTHER', financialInstitutionId: null, financialInstitutionName: null },
        ]),
      ),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Instituição obrigatória');
    expect(screen.getAllByText('Sem instituição')).toHaveLength(2);
    expect(screen.queryByText('Autocustódia')).not.toBeInTheDocument();
  });

  it('shows an em dash when an account has no matching balance', async () => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACTIVE, INACTIVE])),
      http.get('/api/accounts/instrument-balances', () => HttpResponse.json([])),
    );

    renderPage();

    expect(await screen.findByText('Millennium')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('sends no includeInactive and shows only active rows by default', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get('/api/accounts', ({ request }) => {
        requestUrl = new URL(request.url);

        return HttpResponse.json([ACTIVE]);
      }),
    );

    renderPage();

    expect(await screen.findByText('Millennium')).toBeInTheDocument();
    expect(requestUrl?.searchParams.has('includeInactive')).toBe(false);
  });

  it('sends includeInactive=true and renders the "inativa" badge once the toggle is on', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get('/api/accounts', ({ request }) => {
        requestUrl = new URL(request.url);
        const includeInactive = requestUrl.searchParams.get('includeInactive') === 'true';

        return HttpResponse.json(includeInactive ? [ACTIVE, INACTIVE] : [ACTIVE]);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('switch', { name: 'Mostrar inativas' }));

    expect(await screen.findByText('Activobank')).toBeInTheDocument();
    expect(screen.getByText('inativa')).toBeInTheDocument();
    expect(requestUrl?.searchParams.get('includeInactive')).toBe('true');
  });

  it('creates an account and reflects it in the list without a reload', async () => {
    let accounts = [ACTIVE];
    server.use(
      http.get('/api/accounts', () => HttpResponse.json(accounts)),
      http.post('/api/accounts', async ({ request }) => {
        const body = (await request.json()) as { name: string };
        const created = { ...ACTIVE, id: 'a3', name: body.name };
        accounts = [...accounts, created];

        return HttpResponse.json(created);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Nova conta' }));
    await user.click(screen.getByLabelText('Tipo de conta'));
    await user.click(screen.getByRole('option', { name: 'Outro' }));
    await user.type(screen.getByLabelText('Nome'), 'Revolut');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Revolut')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('edits an account and reflects name, kind, and Financial Institution without a reload', async () => {
    let current: AccountDto = { ...ACTIVE, kind: 'BANK', financialInstitutionId: 'institution-1', financialInstitutionName: 'Banco Antigo' };
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([current])),
      http.get('/api/financial-institutions', () =>
        HttpResponse.json([
          { id: 'institution-1', name: 'Banco Antigo' },
          { id: 'institution-2', name: 'Banco Novo' },
        ]),
      ),
      http.patch('/api/accounts/:id', async ({ request }) => {
        const body = (await request.json()) as { name: string; kind: 'BROKERAGE'; financialInstitutionId: string };
        current = { ...current, name: body.name, kind: body.kind, financialInstitutionId: body.financialInstitutionId, financialInstitutionName: 'Banco Novo' };

        return HttpResponse.json(current);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Millennium bcp');
    await user.click(screen.getByLabelText('Tipo de conta'));
    await user.click(screen.getByRole('option', { name: 'Corretora' }));
    await user.click(screen.getByLabelText('Instituição financeira'));
    await user.click(screen.getByRole('option', { name: 'Banco Novo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Millennium bcp')).toBeInTheDocument();
    expect(screen.getByText('Corretora')).toBeInTheDocument();
    expect(screen.getByText('Banco Novo')).toBeInTheDocument();
  });

  it('refreshes Instrument Balances after editing an Initial Balance', async () => {
    const initialBalance = { instrumentId: 'eur', instrumentName: 'Euro', instrumentCode: 'EUR', quantity: '1' };
    let current: AccountDto = {
      ...ACTIVE,
      initialBalances: [initialBalance],
    };
    let balance = '1';
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([current])),
      http.get('/api/instruments', () =>
        HttpResponse.json([{ id: 'eur', name: 'Euro', code: 'EUR', type: 'FIAT', displayPrecision: 2, isActive: true, sortOrder: 0 }]),
      ),
      http.get('/api/accounts/instrument-balances', () => HttpResponse.json([{ ...BALANCES[0], quantity: balance }])),
      http.patch('/api/accounts/:id', async ({ request }) => {
        const body = (await request.json()) as { initialBalances: [{ quantity: string }] };
        balance = body.initialBalances[0].quantity;
        current = { ...current, initialBalances: [{ ...initialBalance, quantity: balance }] };

        return HttpResponse.json(current);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('1 EUR');
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Quantidade'));
    await user.type(screen.getByLabelText('Quantidade'), '2');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('2 EUR')).toBeInTheDocument();
  });

  it('fires no request until the deactivate confirmation is clicked', async () => {
    let deactivateCalls = 0;
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACTIVE])),
      http.patch('/api/accounts/:id/deactivate', () => {
        deactivateCalls += 1;

        return HttpResponse.json({ ...ACTIVE, isActive: false });
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(deactivateCalls).toBe(0);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(deactivateCalls).toBe(1);
    });
  });

  it('shows the API error and keeps the account active when deactivation is blocked', async () => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACTIVE])),
      http.patch('/api/accounts/:id/deactivate', () =>
        HttpResponse.json({ statusCode: 409, code: 'ACCOUNT_NOT_EMPTY', message: 'Account still holds Instrument Balances.' }, { status: 409 }),
      ),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(await within(dialog).findByText('A conta ainda tem saldo. Zere-a antes de desativar.')).toBeInTheDocument();
    expect(screen.getByText('Millennium')).toBeInTheDocument();
  });

  it('shows the translated message and an offer to deactivate on a 409 delete', async () => {
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([ACTIVE])),
      http.delete('/api/accounts/:id', () => HttpResponse.json({ statusCode: 409, code: 'RECORD_IN_USE', message: 'in use' }, { status: 409 })),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Apagar' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Apagar' }));

    expect(await within(dialog).findByText('Outros registos ainda usam este. Desative-o em vez de o eliminar.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
  });

  it('renders the empty state and its action opens the dialog', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json([])));

    const { user } = renderPage();

    await screen.findByText('Nenhuma conta cadastrada');
    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Nova conta' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    let calls = 0;
    server.use(
      http.get('/api/accounts', () => {
        calls += 1;

        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([ACTIVE]);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Não foi possível carregar as contas');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Millennium')).toBeInTheDocument();
  });
});

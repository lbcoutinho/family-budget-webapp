import { type AccountDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { AccountsPage } from './accounts-page';

import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test/server';

const ACTIVE: AccountDto = {
  id: 'a1',
  name: 'Millennium',
  initialBalance: 348215,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const INACTIVE: AccountDto = {
  id: 'a2',
  name: 'Activobank',
  initialBalance: 0,
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

describe('AccountsPage', () => {
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
        const body = (await request.json()) as { name: string; initialBalance: number };
        const created = { ...ACTIVE, id: 'a3', name: body.name, initialBalance: body.initialBalance };
        accounts = [...accounts, created];

        return HttpResponse.json(created);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Nova conta' }));
    await user.type(screen.getByLabelText('Nome'), 'Revolut');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Revolut')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('edits an account and reflects the change without a reload', async () => {
    let current = ACTIVE;
    server.use(
      http.get('/api/accounts', () => HttpResponse.json([current])),
      http.patch('/api/accounts/:id', async ({ request }) => {
        const body = (await request.json()) as { name: string; initialBalance: number };
        current = { ...current, name: body.name, initialBalance: body.initialBalance };

        return HttpResponse.json(current);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Millennium');
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Millennium bcp');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Millennium bcp')).toBeInTheDocument();
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

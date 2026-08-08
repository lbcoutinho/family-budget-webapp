import { type CashboxDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { CashboxesPage } from './cashboxes-page';

import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test/server';

const ACTIVE: CashboxDto = {
  id: 'c1',
  name: 'Férias 2027',
  description: null,
  targetAmount: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const INACTIVE: CashboxDto = {
  id: 'c2',
  name: 'Emergência',
  description: null,
  targetAmount: null,
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
          <CashboxesPage />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('CashboxesPage', () => {
  it('hides inactive cashboxes by default and reveals them with the "inativa" badge once toggled', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get('/api/cashboxes', ({ request }) => {
        requestUrl = new URL(request.url);
        const includeInactive = requestUrl.searchParams.get('includeInactive') === 'true';

        return HttpResponse.json(includeInactive ? [ACTIVE, INACTIVE] : [ACTIVE]);
      }),
    );

    const { user } = renderPage();

    expect(await screen.findByText('Férias 2027')).toBeInTheDocument();
    expect(screen.queryByText('Emergência')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Mostrar inativas' }));

    expect(await screen.findByText('Emergência')).toBeInTheDocument();
    expect(screen.getByText('inativa')).toBeInTheDocument();
    expect(requestUrl?.searchParams.get('includeInactive')).toBe('true');
  });

  it('creates a cashbox, posting the goal as integer cents, and shows the new card without a reload', async () => {
    let cashboxes = [ACTIVE];
    let requestBody: { name: string; description: string | null; targetAmount: number | null } | undefined;
    server.use(
      http.get('/api/cashboxes', () => HttpResponse.json(cashboxes)),
      http.post('/api/cashboxes', async ({ request }) => {
        requestBody = (await request.json()) as typeof requestBody;
        const created: CashboxDto = { ...ACTIVE, id: 'c3', name: requestBody!.name, targetAmount: requestBody!.targetAmount };
        cashboxes = [...cashboxes, created];

        return HttpResponse.json(created);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Férias 2027');
    await user.click(screen.getByRole('button', { name: 'Nova caixinha' }));
    await user.type(screen.getByLabelText('Nome'), 'Reforma da cozinha');
    await user.type(screen.getByLabelText('Meta'), '5.000,00');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Reforma da cozinha')).toBeInTheDocument();
    expect(requestBody?.targetAmount).toBe(500000);
  });

  it('leaves the goal blank as null and renders the card with no goal block', async () => {
    let cashboxes = [ACTIVE];
    let requestBody: { name: string; description: string | null; targetAmount: number | null } | undefined;
    server.use(
      http.get('/api/cashboxes', () => HttpResponse.json(cashboxes)),
      http.post('/api/cashboxes', async ({ request }) => {
        requestBody = (await request.json()) as typeof requestBody;
        const created: CashboxDto = { ...ACTIVE, id: 'c4', name: requestBody!.name, targetAmount: requestBody!.targetAmount };
        cashboxes = [...cashboxes, created];

        return HttpResponse.json(created);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Férias 2027');
    await user.click(screen.getByRole('button', { name: 'Nova caixinha' }));
    await user.type(screen.getByLabelText('Nome'), 'Presente de aniversário');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Presente de aniversário')).toBeInTheDocument();
    expect(requestBody?.targetAmount).toBeNull();
    expect(screen.queryByText(/meta/i)).not.toBeInTheDocument();
  });

  it('prefills the edit form and issues a PATCH with the changed fields', async () => {
    let current = ACTIVE;
    let requestBody: { name: string } | undefined;
    server.use(
      http.get('/api/cashboxes', () => HttpResponse.json([current])),
      http.patch('/api/cashboxes/:id', async ({ request }) => {
        requestBody = (await request.json()) as typeof requestBody;
        current = { ...current, name: requestBody!.name };

        return HttpResponse.json(current);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Férias 2027');
    await user.click(screen.getByRole('button', { name: 'Editar' }));

    expect(screen.getByLabelText('Nome')).toHaveValue('Férias 2027');

    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Férias 2028');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Férias 2028')).toBeInTheDocument();
    expect(requestBody?.name).toBe('Férias 2028');
  });

  it('asks for confirmation with the reversible variant before deactivating', async () => {
    let deactivateCalls = 0;
    server.use(
      http.get('/api/cashboxes', () => HttpResponse.json([ACTIVE])),
      http.patch('/api/cashboxes/:id/deactivate', () => {
        deactivateCalls += 1;

        return HttpResponse.json({ ...ACTIVE, isActive: false });
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Férias 2027');
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    expect(deactivateCalls).toBe(0);

    const dialog = await screen.findByRole('dialog');
    // Reversible action: the confirm button keeps the default (not destructive) variant.
    const confirmButton = within(dialog).getByRole('button', { name: 'Desativar' });
    expect(confirmButton).toHaveAttribute('data-variant', 'default');

    await user.click(confirmButton);

    await waitFor(() => {
      expect(deactivateCalls).toBe(1);
    });
  });

  it('asks for confirmation stating permanence, then swaps to an offer to deactivate on a 409', async () => {
    let deactivateCalls = 0;
    server.use(
      http.get('/api/cashboxes', () => HttpResponse.json([ACTIVE])),
      http.delete('/api/cashboxes/:id', () => HttpResponse.json({ statusCode: 409, code: 'RECORD_IN_USE', message: 'in use' }, { status: 409 })),
      http.patch('/api/cashboxes/:id/deactivate', () => {
        deactivateCalls += 1;

        return HttpResponse.json({ ...ACTIVE, isActive: false });
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Férias 2027');
    await user.click(screen.getByRole('button', { name: 'Apagar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Apagar' }));

    expect(await within(dialog).findByText('Outros registos ainda usam este. Desative-o em vez de o eliminar.')).toBeInTheDocument();
    const deactivateOffer = within(dialog).getByRole('button', { name: 'Desativar' });
    await user.click(deactivateOffer);

    await waitFor(() => {
      expect(deactivateCalls).toBe(1);
    });
  });

  it('shows the empty state explaining what a cashbox is', async () => {
    server.use(http.get('/api/cashboxes', () => HttpResponse.json([])));

    renderPage();

    expect(await screen.findByText('Nenhuma caixinha ainda')).toBeInTheDocument();
    expect(screen.getByText(/Uma caixinha separa dinheiro/)).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    let calls = 0;
    server.use(
      http.get('/api/cashboxes', () => {
        calls += 1;

        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([ACTIVE]);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Não foi possível carregar as caixinhas');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Férias 2027')).toBeInTheDocument();
  });
});

import { type CategoryDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { CategoriesPage } from './categories-page';

import { TooltipProvider } from '@/components/ui/tooltip';
import { COMPACT_VIEWPORT, stubMatchMedia } from '@/test/match-media';
import { server } from '@/test/server';

const CHILD: CategoryDto = {
  id: 'c1',
  parentId: 'r1',
  name: 'Renda',
  kind: 'EXPENSE',
  color: null,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const OTHERS: CategoryDto = {
  id: 'c2',
  parentId: 'r1',
  name: 'Outros',
  kind: 'EXPENSE',
  color: null,
  isActive: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ROOT: CategoryDto = {
  id: 'r1',
  parentId: null,
  name: 'Habitação',
  kind: 'EXPENSE',
  color: '#3b82f6',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  children: [CHILD, OTHERS],
};

const INCOME_ROOT: CategoryDto = {
  id: 'r2',
  parentId: null,
  name: 'Salário',
  kind: 'INCOME',
  color: '#22c55e',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  children: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CategoriesPage />
        </TooltipProvider>
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}

describe('CategoriesPage', () => {
  it('keeps children collapsed until the caret is clicked', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([ROOT])));

    const { user } = renderPage();

    await screen.findByText('Habitação');
    expect(screen.queryByText('Renda')).not.toBeInTheDocument();

    const caret = screen.getByRole('button', { name: 'Expandir Habitação' });
    expect(caret).toHaveAttribute('aria-expanded', 'false');
    await user.click(caret);

    expect(await screen.findByText('Renda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recolher Habitação' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the automatic badge only on the "Outros" subcategory', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([ROOT])));

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Expandir Habitação' }));

    const rendaRow = screen.getByText('Renda').closest('tr');
    const outrosRow = screen.getByText('Outros').closest('tr');

    expect(rendaRow ? within(rendaRow).queryByText('automática') : null).not.toBeInTheDocument();
    expect(outrosRow ? within(outrosRow).queryByText('automática') : null).toBeInTheDocument();
  });

  it('separates income and expense tabs from a single request', async () => {
    let calls = 0;
    server.use(
      http.get('/api/categories', () => {
        calls += 1;

        return HttpResponse.json([ROOT, INCOME_ROOT]);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Habitação');
    expect(screen.queryByText('Salário')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Receita' }));

    expect(await screen.findByText('Salário')).toBeInTheDocument();
    expect(screen.queryByText('Habitação')).not.toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('creates a subcategory with the parent shown as a label and no kind or colour posted', async () => {
    let posted: unknown;
    server.use(
      http.get('/api/categories', () => HttpResponse.json([ROOT])),
      http.post('/api/categories', async ({ request }) => {
        posted = await request.json();

        return HttpResponse.json(CHILD);
      }),
    );

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Adicionar subcategoria a Habitação' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Categoria')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Habitação')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Nome'), 'Condomínio');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(posted).toEqual({ name: 'Condomínio', parentId: 'r1' });
    });
  });

  it('cascades the inactive badge onto every subcategory when a root is deactivated', async () => {
    let root = ROOT;
    server.use(
      http.get('/api/categories', () => HttpResponse.json([root])),
      http.patch('/api/categories/:id/deactivate', () => {
        root = { ...root, isActive: false, children: root.children?.map((child) => ({ ...child, isActive: false })) };

        return HttpResponse.json(root);
      }),
    );

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(screen.getAllByText('inativa').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: 'Expandir Habitação' }));
    const rows = screen.getAllByText('inativa');
    expect(rows.length).toBe(3);
  });

  it('renders the translated message for the last-active-subcategory conflict, not the raw English message', async () => {
    server.use(
      http.get('/api/categories', () => HttpResponse.json([ROOT])),
      http.patch('/api/categories/:id/deactivate', () =>
        HttpResponse.json({ statusCode: 409, code: 'CATEGORY_LAST_ACTIVE_SUBCATEGORY', message: 'last active subcategory' }, { status: 409 }),
      ),
    );

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Expandir Habitação' }));
    const rendaRow = screen.getByText('Renda').closest('tr');
    await user.click(within(rendaRow!).getByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(screen.getByText('Esta é a última subcategoria ativa da categoria. Desative a categoria principal.')).toBeInTheDocument();
    });
    expect(screen.queryByText('last active subcategory')).not.toBeInTheDocument();
  });

  it('falls back to the unknown-error message for an unrecognized error code', async () => {
    server.use(
      http.get('/api/categories', () => HttpResponse.json([ROOT])),
      http.patch('/api/categories/:id/deactivate', () => HttpResponse.json({ statusCode: 409, code: 'SOMETHING_NEW', message: 'nope' }, { status: 409 })),
    );

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => {
      expect(screen.getByText('Não foi possível concluir a operação. Tente novamente.')).toBeInTheDocument();
    });
  });

  it('clears a stale mutation error when the create dialog is reopened', async () => {
    server.use(
      http.get('/api/categories', () => HttpResponse.json([ROOT])),
      http.post('/api/categories', () => HttpResponse.json({ statusCode: 409, code: 'DUPLICATE_NAME', message: 'duplicate' }, { status: 409 })),
    );

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Nova categoria' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nome'), 'Habitação');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await within(dialog).findByText('Já existe um registo com esse nome.');

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Nova categoria' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText('Já existe um registo com esse nome.')).not.toBeInTheDocument();
  });

  it('offers delete on a subcategory row, not just on the root', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([ROOT])));

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Expandir Habitação' }));
    const rendaRow = screen.getByText('Renda').closest('tr');

    expect(within(rendaRow!).getByRole('button', { name: 'Apagar' })).toBeInTheDocument();
  });

  it('lists roots and subcategories alphabetically, with the automatic "Outros" pinned last', async () => {
    const rootB: CategoryDto = { ...ROOT, id: 'r3', name: 'Zeladoria', children: [] };
    server.use(http.get('/api/categories', () => HttpResponse.json([ROOT, rootB])));

    const { user } = renderPage();

    await screen.findByText('Zeladoria');
    const rootNames = screen
      .getAllByRole('row')
      .slice(1, 3)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(rootNames).toEqual(['Habitação', 'Zeladoria']);

    await user.click(screen.getByRole('button', { name: 'Expandir Habitação' }));
    const childNames = (await screen.findAllByRole('row')).slice(2, 4).map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(childNames?.[0]).toContain('Renda');
    expect(childNames?.[1]).toContain('Outros');
  });

  it('renders the empty state for a kind with no categories', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([])));

    renderPage();

    expect(await screen.findByText('Nenhuma categoria de despesa')).toBeInTheDocument();
  });

  it('exposes the add-subcategory button on both layouts, toggled by CSS not by presence', async () => {
    stubMatchMedia(COMPACT_VIEWPORT);
    server.use(http.get('/api/categories', () => HttpResponse.json([ROOT])));

    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Expandir Habitação' }));

    const buttons = await screen.findAllByRole('button', { name: 'Adicionar subcategoria a Habitação' });
    expect(buttons).toHaveLength(2);
  });

  it('shows the error state and retries', async () => {
    let calls = 0;
    server.use(
      http.get('/api/categories', () => {
        calls += 1;

        return calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json([ROOT]);
      }),
    );

    const { user } = renderPage();

    await screen.findByText('Não foi possível carregar as categorias');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Habitação')).toBeInTheDocument();
  });
});

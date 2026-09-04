import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { COMPACT_VIEWPORT, stubMatchMedia } from '@/test/match-media';
import { server } from '@/test/server';

// The accounts route now renders the real AccountsPage, so any navigation there fetches; a route
// this suite treats as a navigation target, not a screen under test, just needs an empty list.
beforeEach(() => {
  server.use(
    http.get('/api/accounts', () => HttpResponse.json([])),
    http.get('/api/transactions', () =>
      HttpResponse.json({ items: [], total: 0, incomeTotal: 0, expenseTotal: 0, cashboxInTotal: 0, cashboxOutTotal: 0, nextCursor: null }),
    ),
    http.get('/api/reports/monthly', () =>
      HttpResponse.json({
        year: 2026,
        month: 1,
        incomeTotal: 0,
        expenseTotal: 0,
        balance: 0,
        categories: [],
        cashboxes: { items: [], depositsTotal: 0, withdrawalsTotal: 0, balance: 0 },
      }),
    ),
  );
});

const USER = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' as const };

/** The desktop answer is the default from `test/setup.ts`, so only the phone needs saying. */
function useCompactViewport() {
  stubMatchMedia(COMPACT_VIEWPORT);
}

/** The real route table, so what is asserted here is the navigation the application ships. */
function renderShell(initialEntry = '/month', logout = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    logout,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext value={{ user: USER, logout }}>
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: [initialEntry] })} />
        </AuthContext>
      </QueryClientProvider>,
    ),
  };
}

describe('AppLayout', () => {
  it('offers a skip link to the current route content', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'Ir para o conteúdo' })).toHaveAttribute('href', '#route-content');
    expect(document.getElementById('route-content')).toHaveAttribute('tabindex', '-1');
  });

  it('renders every navigation item, with the registries under Configurações', async () => {
    const { user } = renderShell();
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });

    for (const label of ['Mês', 'Caixinhas', 'Relatórios', 'Lançar por voz', 'Recorrências']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }

    // Closed on a route that is not a registry, so the two links are not reachable yet.
    const settings = within(nav).getByRole('button', { name: /Configurações/ });
    expect(settings).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('link', { name: 'Contas' })).not.toBeInTheDocument();

    await user.click(settings);

    expect(within(nav).getByRole('link', { name: 'Geral' })).toHaveAttribute('href', '/settings/general');
    expect(within(nav).getByRole('link', { name: 'Contas' })).toHaveAttribute('href', '/accounts');
    expect(within(nav).getByRole('link', { name: 'Categorias' })).toHaveAttribute('href', '/categories');
  });

  it('marks the active route and opens the submenu the current route lives in', () => {
    renderShell('/accounts');

    const active = screen.getByRole('link', { name: 'Contas' });

    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(screen.getByRole('link', { name: 'Mês' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /Configurações/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('navigates to another route and moves the highlight with it', async () => {
    const { user } = renderShell();

    await user.click(screen.getByRole('link', { name: 'Relatórios' }));

    expect(await screen.findByRole('tab', { name: 'Mensal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Mês' })).not.toHaveAttribute('aria-current');
  });

  it('sends the index route to the month screen', async () => {
    renderShell('/');

    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
  });

  it('shows the user and logs out without asking for confirmation', async () => {
    const { user, logout } = renderShell();

    expect(screen.getByText('Luís Coutinho')).toBeInTheDocument();
    expect(screen.getByText('luis@exemplo.pt')).toBeInTheDocument();
    expect(screen.getByText('LC')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has no menu button on the desktop, where the sidebar is a fixed column', () => {
    renderShell();

    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mês' })).toBeVisible();
  });

  it('turns the sidebar into a drawer on a phone, closing on the scrim and on a choice', async () => {
    useCompactViewport();
    const { user } = renderShell();

    const sidebar = screen.getByRole('dialog');
    expect(sidebar).toHaveAttribute('data-open', 'false');
    expect(sidebar).toHaveAttribute('inert');

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(sidebar).toHaveAttribute('data-open', 'true');
    expect(sidebar).not.toHaveAttribute('inert');
    expect(sidebar).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('link', { name: 'Mês' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Sair' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Mês' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(sidebar).toHaveAttribute('data-open', 'false');
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.click(screen.getByRole('link', { name: 'Caixinhas' }));

    expect(sidebar).toHaveAttribute('data-open', 'false');
    expect(await screen.findByRole('heading', { name: 'Caixinhas' })).toBeInTheDocument();
  });

  it('closes the drawer on Escape', async () => {
    useCompactViewport();
    const { user } = renderShell();

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toHaveAttribute('data-open', 'false');
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveFocus();
  });

  it('keeps an unknown address inside the shell', () => {
    renderShell('/nao-existe');

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mês' })).toBeInTheDocument();
  });
});

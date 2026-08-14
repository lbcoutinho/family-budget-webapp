import { setAccessToken } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './auth-provider';

import { routes } from '@/app/router';
import i18n from '@/i18n';
import { server } from '@/test/server';

const SESSION = { accessToken: 'access-token', user: { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís', locale: 'pt-BR' as const } };

/** The real route table on a memory history, wrapped in the real provider. */
function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: [initialEntry] })} />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

const noSession = () => http.post('/api/auth/refresh', () => new HttpResponse(null, { status: 401 }));
const restoredSession = () => http.post('/api/auth/refresh', () => HttpResponse.json(SESSION));
const emptyTransactions = () =>
  http.get('/api/transactions', () =>
    HttpResponse.json({ items: [], total: 0, incomeTotal: 0, expenseTotal: 0, cashboxInTotal: 0, cashboxOutTotal: 0, nextCursor: null }),
  );

beforeEach(() => {
  server.use(emptyTransactions());
});

afterEach(() => {
  setAccessToken(null);
});

describe('authentication flow', () => {
  it('restores the session on mount and renders the protected route', async () => {
    server.use(restoredSession());

    renderApp('/month/2026/08');

    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  });

  it('shows the verifying state instead of the login form while the refresh is in flight', async () => {
    server.use(
      http.post('/api/auth/refresh', async () => {
        await delay(50);

        return HttpResponse.json(SESSION);
      }),
    );

    renderApp('/');

    expect(screen.getByText('Restaurando sessão…')).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Mês anterior' });
  });

  it('sends a protected route without a session to the login screen', async () => {
    server.use(noSession());

    renderApp('/');

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    // The login screen carries the same brand as the sidebar, so what proves the shell is not
    // rendered is its navigation, not its name.
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
  });

  it('logs in and lands on the home screen', async () => {
    server.use(
      noSession(),
      http.post('/api/auth/login', () => HttpResponse.json(SESSION)),
    );

    const { user } = renderApp('/login');

    await user.type(await screen.findByLabelText('E-mail'), 'luis@exemplo.pt');
    await user.type(screen.getByLabelText('Senha'), 'demo1234');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
  });

  it("wins over the browser's language: a pt-BR session renders even when navigator.language is en-US", async () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');
    server.use(restoredSession());

    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(i18n.language).toBe('pt-BR');
  });

  it('clears the session on logout and returns to the login screen', async () => {
    let cookieCleared = false;
    server.use(
      restoredSession(),
      http.post('/api/auth/logout', () => {
        cookieCleared = true;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { user } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
    await waitFor(() => {
      expect(cookieCleared).toBe(true);
    });
  });
});

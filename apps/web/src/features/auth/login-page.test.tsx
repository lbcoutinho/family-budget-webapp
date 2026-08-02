import { getAccessToken, setAccessToken } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthContext } from './auth-context';
import { LoginPage } from './login-page';

import { server } from '@/test/server';

const SESSION = { accessToken: 'access-token', user: { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís' } };

/**
 * The form on its own, with a signed-out context supplied by hand. `AuthProvider` is exercised by
 * `auth-flow.test.tsx`; here the interest is what the four states of the screen look like.
 */
function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthContext value={{ user: null, logout: () => Promise.resolve() }}>
            <LoginPage />
          </AuthContext>
        </MemoryRouter>
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => {
  setAccessToken(null);
});

describe('LoginPage', () => {
  it('refuses to submit an invalid email or an empty password', async () => {
    const { user } = renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'nao-e-um-email');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe a sua senha.')).toBeInTheDocument();
    // Nothing left for MSW to answer: a request here would fail the suite outright.
  });

  it('shows the busy state in the button while the request is in flight', async () => {
    server.use(
      http.post('/api/auth/login', async () => {
        await delay(50);

        return HttpResponse.json(SESSION);
      }),
    );
    const { user } = renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'luis@exemplo.pt');
    await user.type(screen.getByLabelText('Senha'), 'demo1234');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const submitting = await screen.findByRole('button', { name: /Entrando/ });
    expect(submitting).toBeDisabled();
    expect(screen.getByLabelText('E-mail')).toBeDisabled();
  });

  it('stores the token on success', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json(SESSION)));
    const { user } = renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'luis@exemplo.pt');
    await user.type(screen.getByLabelText('Senha'), 'demo1234');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(getAccessToken()).toBe('access-token');
    });
  });

  it('keeps the typed email, clears the password and focuses it when the credentials are rejected', async () => {
    server.use(http.post('/api/auth/login', () => new HttpResponse(null, { status: 401 })));
    const { user } = renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'luis@exemplo.pt');
    await user.type(screen.getByLabelText('Senha'), 'senha-errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');

    const password = screen.getByLabelText('Senha');
    expect(screen.getByLabelText('E-mail')).toHaveValue('luis@exemplo.pt');
    expect(password).toHaveValue('');
    expect(password).toHaveFocus();
  });

  it('reports a server failure as a toast rather than as a credential error', async () => {
    server.use(http.post('/api/auth/login', () => new HttpResponse(null, { status: 500 })));
    const { user } = renderLoginPage();

    await user.type(screen.getByLabelText('E-mail'), 'luis@exemplo.pt');
    await user.type(screen.getByLabelText('Senha'), 'demo1234');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/Não foi possível entrar/)).toBeInTheDocument();
    expect(screen.queryByText('E-mail ou senha incorretos.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveValue('demo1234');
  });
});

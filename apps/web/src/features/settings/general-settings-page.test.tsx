import { type AuthUserDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { GeneralSettingsPage } from './general-settings-page';

import { AuthContext } from '@/features/auth/auth-context';
import { server } from '@/test/server';

const USER: AuthUserDto = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' };

function renderPage(user: AuthUserDto = USER) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext value={{ user, logout: () => Promise.resolve() }}>
          <GeneralSettingsPage />
        </AuthContext>
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}

describe('GeneralSettingsPage', () => {
  it('shows the current locale and saves immediately on change, with a confirming toast', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/users/me', async ({ request }) => {
        requestBody = await request.json();

        return HttpResponse.json({ ...USER, locale: 'en-US' });
      }),
    );

    const { user } = renderPage();

    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveTextContent('Português (Brasil)');

    await user.click(screen.getByRole('combobox', { name: 'Idioma' }));
    await user.click(screen.getByRole('option', { name: 'English (US)' }));

    expect(requestBody).toEqual({ locale: 'en-US' });
    expect(await screen.findByText('Idioma atualizado para English (US).')).toBeInTheDocument();
  });

  it('leaves the select on the previous locale and explains the failure when the save fails', async () => {
    server.use(http.patch('/api/users/me', () => new HttpResponse(null, { status: 500 })));

    const { user } = renderPage();

    await user.click(screen.getByRole('combobox', { name: 'Idioma' }));
    await user.click(screen.getByRole('option', { name: 'English (US)' }));

    expect(await screen.findByText('Não foi possível salvar. O idioma voltou para Português (Brasil).')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveTextContent('Português (Brasil)');
  });
});

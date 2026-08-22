import { type AuthUserDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GeneralSettingsPage } from './general-settings-page';

import { AuthContext } from '@/features/auth/auth-context';
import { server } from '@/test/server';

const USER: AuthUserDto = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' };
let createObjectURLDescriptor: PropertyDescriptor | undefined;
let revokeObjectURLDescriptor: PropertyDescriptor | undefined;

function renderPage(user: AuthUserDto = USER, isAdmin = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthContext value={{ user, isAdmin, logout: () => Promise.resolve() }}>
          <GeneralSettingsPage />
        </AuthContext>
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (createObjectURLDescriptor) Object.defineProperty(URL, 'createObjectURL', createObjectURLDescriptor);
  else delete (URL as Partial<typeof URL>).createObjectURL;
  if (revokeObjectURLDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectURLDescriptor);
  else delete (URL as Partial<typeof URL>).revokeObjectURL;
  createObjectURLDescriptor = undefined;
  revokeObjectURLDescriptor = undefined;
});

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

  it('hides data backup from non-administrators', () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: 'Backup dos dados' })).not.toBeInTheDocument();
  });

  it('asks an administrator to confirm and does not request a backup when cancelled', async () => {
    let requested = false;
    server.use(
      http.get('/api/backups/database', () => {
        requested = true;

        return new HttpResponse(null);
      }),
    );
    const { user } = renderPage(USER, true);

    await user.click(screen.getByRole('button', { name: 'Baixar backup' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(requested).toBe(false);
  });

  it('prevents a duplicate request while a backup is being generated', async () => {
    let respond!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      respond = resolve;
    });
    server.use(
      http.get('/api/backups/database', async () => {
        await inFlight;

        return HttpResponse.json({ message: 'still unavailable' }, { status: 503 });
      }),
    );
    const { user } = renderPage(USER, true);

    await user.click(screen.getByRole('button', { name: 'Baixar backup' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Gerar e baixar' }));

    expect((await screen.findAllByText('Gerando o backup. Não feche esta página até o download começar.')).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Baixar backup', hidden: true })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Gerar e baixar' })).toBeDisabled();

    respond();
  });

  it('downloads the server-provided filename after confirmation', async () => {
    const createObjectURL = vi.fn(() => 'blob:backup');
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    createObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    server.use(
      http.get(
        '/api/backups/database',
        () =>
          new HttpResponse(new Blob(['backup']), {
            headers: { 'Content-Disposition': 'attachment; filename="family-budget-backup-2026-08-22T12-00-00Z.dump"' },
          }),
      ),
    );
    const { user } = renderPage(USER, true);

    await user.click(screen.getByRole('button', { name: 'Baixar backup' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Gerar e baixar' }));

    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect((click.mock.instances[0] as HTMLAnchorElement | undefined)?.download).toBe('family-budget-backup-2026-08-22T12-00-00Z.dump');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });

  it('explains a missing PostgreSQL 16 client and restores the controls', async () => {
    server.use(http.get('/api/backups/database', () => HttpResponse.json({ message: 'missing' }, { status: 503 })));
    const { user } = renderPage(USER, true);

    await user.click(screen.getByRole('button', { name: 'Baixar backup' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Gerar e baixar' }));

    expect(
      (await screen.findAllByText('Não foi possível gerar o backup porque as ferramentas do PostgreSQL 16 não estão instaladas no servidor.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Baixar backup' })).toBeEnabled();
  });
});

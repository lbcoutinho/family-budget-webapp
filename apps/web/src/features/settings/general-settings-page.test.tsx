import { type AuthUserDto, type CsvImportModelDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { Toaster } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GeneralSettingsPage } from './general-settings-page';

import { AuthContext } from '@/features/auth/auth-context';
import { server } from '@/test/server';

const USER: AuthUserDto = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' };
const MODEL: CsvImportModelDto = {
  id: 'model-1',
  name: 'Banco Atlântico',
  headerLineCount: 1,
  separator: ';',
  dateHeader: 'Data',
  descriptionHeader: 'Histórico',
  amountHeader: 'Valor',
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
};
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

beforeEach(() => {
  server.use(http.get('/api/csv-import-models', () => HttpResponse.json([])));
});

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
  it('shows the compact empty state and explains that a model is needed before importing', async () => {
    renderPage();

    expect(await screen.findByText('Nenhum modelo CSV registrado.')).toBeInTheDocument();
    expect(screen.getByText('Crie um modelo antes de importar lançamentos.')).toBeInTheDocument();
  });

  it('shows loading and error states for CSV models', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    server.use(
      http.get('/api/csv-import-models', async () => {
        await pending;
        return HttpResponse.json([]);
      }),
    );
    const { unmount } = renderPage();

    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    resolve();
    unmount();

    server.use(http.get('/api/csv-import-models', () => HttpResponse.json({ message: 'nope' }, { status: 500 })));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os modelos CSV.');
  });

  it('lists models and creates one without a page reload', async () => {
    let models = [MODEL];
    let requestBody: unknown;
    server.use(
      http.get('/api/csv-import-models', () => HttpResponse.json(models)),
      http.post('/api/csv-import-models', async ({ request }) => {
        requestBody = await request.json();
        models = [...models, { ...MODEL, id: 'model-2', name: 'Cartão Horizonte' }];
        return HttpResponse.json(models[1], { status: 201 });
      }),
    );
    const { user } = renderPage();

    expect(await screen.findByText('Banco Atlântico')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Novo modelo' }));
    expect(await screen.findByLabelText('Nome')).toHaveFocus();
    await user.type(screen.getByLabelText('Nome'), 'Cartão Horizonte');
    await user.click(screen.getByRole('button', { name: 'Criar modelo' }));

    expect(requestBody).toEqual({
      name: 'Cartão Horizonte',
      headerLineCount: 1,
      separator: ';',
      dateHeader: 'Data',
      descriptionHeader: 'Histórico',
      amountHeader: 'Valor',
    });
    expect(await screen.findByText('Cartão Horizonte')).toBeInTheDocument();
  });

  it('validates model creation and reports duplicate names in the dialog', async () => {
    server.use(http.post('/api/csv-import-models', () => HttpResponse.json({ code: 'DUPLICATE_NAME', message: 'duplicate' }, { status: 409 })));
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Novo modelo' }));
    await user.click(screen.getByRole('button', { name: 'Criar modelo' }));
    expect(await screen.findByText('Informe o nome do modelo.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome'), 'Banco Atlântico');
    await user.click(screen.getByRole('button', { name: 'Criar modelo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um registo com esse nome.');
  });

  it('names deletion, restores focus on cancellation, and refreshes after deletion', async () => {
    let models = [MODEL];
    server.use(
      http.get('/api/csv-import-models', () => HttpResponse.json(models)),
      http.delete('/api/csv-import-models/:id', () => {
        models = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user } = renderPage();

    const deleteButton = await screen.findByRole('button', { name: 'Excluir modelo Banco Atlântico' });
    await user.click(deleteButton);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Excluir “Banco Atlântico”?');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await vi.waitFor(() => expect(deleteButton).toHaveFocus());
    await user.click(deleteButton);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir Banco Atlântico' }));
    expect(await screen.findByText('Nenhum modelo CSV registrado.')).toBeInTheDocument();
  });

  it('keeps named deletion open and reports a deletion failure', async () => {
    server.use(
      http.get('/api/csv-import-models', () => HttpResponse.json([MODEL])),
      http.delete('/api/csv-import-models/:id', () => HttpResponse.json({ code: 'SOMETHING_NEW', message: 'nope' }, { status: 500 })),
    );
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Excluir modelo Banco Atlântico' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir Banco Atlântico' }));
    expect(await screen.findByText('Não foi possível concluir a operação. Tente novamente.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('Excluir “Banco Atlântico”?');
  });

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

  it('hides administration from non-administrators', () => {
    renderPage();

    expect(screen.queryByRole('heading', { name: 'Administração' })).not.toBeInTheDocument();
  });

  it('groups data backup as an administrative option and shows its warning only after confirmation', async () => {
    const { user } = renderPage(USER, true);

    expect(screen.getByRole('heading', { name: 'Administração' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Backup dos dados' })).toBeInTheDocument();
    expect(screen.getByText('Gera e baixa um backup completo do sistema.')).toBeInTheDocument();
    expect(
      screen.queryByText('O arquivo não é criptografado e contém todos os dados financeiros e de autenticação. Guarde-o em um local seguro.'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gerar backup' }));

    expect(
      within(await screen.findByRole('dialog')).getByText(
        'O arquivo não é criptografado e contém todos os dados financeiros e de autenticação. Guarde-o em um local seguro.',
      ),
    ).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Gerar backup' }));
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

    await user.click(screen.getByRole('button', { name: 'Gerar backup' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Gerar e baixar' }));

    expect((await screen.findAllByText('Gerando o backup. Não feche esta página até o download começar.')).length).toBe(2);
    expect(screen.getByRole('button', { name: 'Gerar backup', hidden: true })).toBeDisabled();
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

    await user.click(screen.getByRole('button', { name: 'Gerar backup' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Gerar e baixar' }));

    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect((click.mock.instances[0] as HTMLAnchorElement | undefined)?.download).toBe('family-budget-backup-2026-08-22T12-00-00Z.dump');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });

  it('explains a missing PostgreSQL 16 client and restores the controls', async () => {
    server.use(http.get('/api/backups/database', () => HttpResponse.json({ message: 'missing' }, { status: 503 })));
    const { user } = renderPage(USER, true);

    await user.click(screen.getByRole('button', { name: 'Gerar backup' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Gerar e baixar' }));

    expect(
      (await screen.findAllByText('Não foi possível gerar o backup porque as ferramentas do PostgreSQL 16 não estão instaladas no servidor.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Gerar backup' })).toBeEnabled();
  });
});

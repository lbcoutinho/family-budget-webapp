import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  preview: vi.fn<(value: { data: { modelId: string; accountId: string; file: File } }) => void>(),
  confirm: vi.fn<(value: { data: { selectedLines: number[]; file: File } }) => void>(),
}));

vi.mock('@family-budget/api-client', () => ({
  useListCsvImportModels: () => ({ data: [{ id: 'model-1', name: 'Banco Atlântico' }], isPending: false, isError: false, refetch: vi.fn() }),
  useListAccounts: () => ({ data: [{ id: 'account-1', name: 'Conta corrente' }], isPending: false, isError: false, refetch: vi.fn() }),
  usePreviewCsvImport: (options: { mutation: { onSuccess: (result: unknown) => void } }) => ({
    mutate: (value: { data: { modelId: string; accountId: string; file: File } }) => {
      api.preview(value);
      options.mutation.onSuccess({
        new: [{ line: 3 }, { line: 8 }],
        duplicate: [{ line: 5, reason: 'Já existe nesta conta' }],
        invalid: [{ line: 6, reason: 'Data inexistente' }],
        notSelected: [],
      });
    },
    isPending: false,
    isError: false,
  }),
  useConfirmCsvImport: (options: { mutation: { onSuccess: (result: unknown) => void } }) => ({
    mutate: (value: { data: { modelId: string; accountId: string; selectedLines: number[]; file: File } }) => {
      api.confirm(value);
      options.mutation.onSuccess({
        new: [{ line: 3 }],
        duplicate: [{ line: 5 }],
        invalid: [{ line: 6, reason: 'Data inexistente' }],
        notSelected: [{ line: 8 }],
      });
    },
    isPending: false,
    isError: false,
  }),
}));

import { CsvImportPage } from './csv-import-page';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CsvImportPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

async function uploadPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Modelo CSV'), 'model-1');
  await user.selectOptions(screen.getByLabelText('Conta de destino'), 'account-1');
  await user.upload(screen.getByLabelText('Arquivo CSV'), new File(['data'], 'statement.csv', { type: 'text/csv' }));
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
}

describe('CsvImportPage', () => {
  it('previews with the selected model, account, and file, with new rows selected', async () => {
    const { user } = renderPage();
    await uploadPreview(user);
    expect(screen.getByText('2 de 2 linhas novas selecionadas. A prévia ainda não grava lançamentos.')).toBeInTheDocument();
    const request = api.preview.mock.calls[0]?.[0];
    expect(request?.data.modelId).toBe('model-1');
    expect(request?.data.accountId).toBe('account-1');
    expect(request?.data.file).toBeInstanceOf(File);
    expect(screen.getByRole('checkbox', { name: 'duplicada' })).toBeDisabled();
  });

  it('explains why confirmation is disabled when no new row is selected', async () => {
    const { user } = renderPage();
    await uploadPreview(user);
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar todas as linhas novas' }));
    expect(screen.getByRole('button', { name: 'Importar lançamentos' })).toBeDisabled();
    expect(screen.getByText('Nenhuma linha nova está selecionada')).toBeInTheDocument();
  });

  it('resends the original file and selected lines, then shows result details', async () => {
    const { user } = renderPage();
    await uploadPreview(user);
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar linha 8' }));
    await user.click(screen.getByRole('button', { name: 'Importar 1 lançamento' }));
    expect(screen.getByText('1 lançamento importado como rascunho')).toBeInTheDocument();
    const request = api.confirm.mock.calls[0]?.[0];
    expect(request?.data.selectedLines).toEqual([3]);
    expect(request?.data.file).toBeInstanceOf(File);
    expect(screen.getByText('1 válidas não selecionadas')).toBeInTheDocument();
  });
});

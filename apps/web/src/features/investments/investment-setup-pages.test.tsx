import { type AssetListingDto, type FinancialInstitutionDto, type InstrumentDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { describe, expect, it } from 'vitest';

import { AssetListingsPage, FinancialInstitutionsPage, InstrumentsPage } from './investment-setup-pages';

import { TooltipProvider } from '@/components/ui/tooltip';
import { server } from '@/test/server';

const INSTITUTION: FinancialInstitutionDto = {
  id: 'institution-1',
  name: 'Banco Example',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const INSTRUMENT: InstrumentDto = {
  id: 'instrument-1',
  name: 'Euro',
  code: 'EUR',
  type: 'FIAT',
  displayPrecision: 2,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const LISTING: AssetListingDto = {
  id: 'listing-1',
  instrumentId: INSTRUMENT.id,
  instrumentName: INSTRUMENT.name,
  quoteInstrumentId: INSTRUMENT.id,
  quoteInstrumentCode: INSTRUMENT.code,
  market: 'Euronext',
  ticker: 'EXM',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{page}</TooltipProvider>
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}

describe('Investment setup registries', () => {
  it.each([
    ['Institution', 'Nova instituição', FinancialInstitutionsPage, '/api/financial-institutions', [INSTITUTION]],
    ['Instrument', 'Novo instrumento', InstrumentsPage, '/api/instruments', [INSTRUMENT]],
    ['Listing', 'Nova listagem', AssetListingsPage, '/api/asset-listings', [LISTING]],
  ] as const)('uses a resource-specific create action for %s', async (_resource, label, Page, path, rows) => {
    server.use(
      http.get(path, () => HttpResponse.json(rows)),
      ...(path === '/api/asset-listings' ? [http.get('/api/instruments', () => HttpResponse.json([INSTRUMENT]))] : []),
    );

    renderPage(<Page />);

    expect(await screen.findByRole('button', { name: label })).toBeInTheDocument();
  });

  it('uses accessible icon actions and leaves the actions heading visually hidden', async () => {
    server.use(http.get('/api/financial-institutions', () => HttpResponse.json([INSTITUTION, { ...INSTITUTION, id: 'institution-2', isActive: false }])));

    const { user } = renderPage(<FinancialInstitutionsPage />);

    const row = (await screen.findByText(INSTITUTION.name)).closest('tr')!;
    const edit = within(row).getByRole('button', { name: 'Editar' });
    expect(edit).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
    expect(screen.getByText('Ações')).toHaveClass('sr-only');
    await user.hover(edit);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Editar');

    await user.click(screen.getByRole('switch', { name: 'Mostrar inativos' }));
    expect(within(screen.getAllByText(INSTITUTION.name)[1]!.closest('tr')!).getByRole('button', { name: 'Reativar' })).toBeInTheDocument();
  });

  it('does not show or submit a financial institution kind', async () => {
    let posted: unknown;
    let updated: unknown;
    server.use(
      http.get('/api/financial-institutions', () => HttpResponse.json([INSTITUTION])),
      http.post('/api/financial-institutions', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(INSTITUTION);
      }),
      http.patch('/api/financial-institutions/:id', async ({ request }) => {
        updated = await request.json();
        return HttpResponse.json(INSTITUTION);
      }),
    );

    const { user } = renderPage(<FinancialInstitutionsPage />);

    await user.click(await screen.findByRole('button', { name: 'Nova instituição' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Tipo')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nome'), 'Banco Novo');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(posted).toEqual({ name: 'Banco Novo' });

    const row = screen.getByText(INSTITUTION.name).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Editar' }));
    expect(within(await screen.findByRole('dialog')).queryByLabelText('Tipo')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Banco Editado');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(updated).toEqual({ name: 'Banco Editado' });
  });

  it('explains listing fields with accessible market and cryptocurrency examples', async () => {
    server.use(
      http.get('/api/asset-listings', () => HttpResponse.json([])),
      http.get('/api/instruments', () => HttpResponse.json([INSTRUMENT])),
    );

    const { user } = renderPage(<AssetListingsPage />);
    await user.click(await screen.findByRole('button', { name: 'Nova listagem' }));

    expect(screen.getByLabelText('Mercado')).toHaveAccessibleDescription('Local de negociação, por exemplo XETRA ou Kraken.');
    expect(screen.getByLabelText('Ticker')).toHaveAccessibleDescription('Código do ativo ou par no local, por exemplo VWCE ou BTC-EUR.');
    expect(screen.getByLabelText('ISIN')).toHaveAccessibleDescription(
      'Identificador do título, por exemplo IE00BK5BQT80. Criptomoedas nativas normalmente não têm ISIN.',
    );
    expect(screen.getByLabelText('Símbolo do provedor')).toHaveAccessibleDescription(
      'Identificador opcional do provedor de cotações, por exemplo VWCE.XETRA ou BTC-EUR.CC.',
    );
  });
});

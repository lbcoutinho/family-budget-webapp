import { type TransactionListDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import i18n from '.';

import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { formatMonth } from '@/lib/date';
import { formatCents } from '@/lib/money';
import { server } from '@/test/server';

const USER = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' as const };
const EMPTY_TRANSACTIONS: TransactionListDto = {
  items: [],
  total: 0,
  incomeTotal: 0,
  expenseTotal: 0,
  cashboxInTotal: 0,
  cashboxOutTotal: 0,
  nextCursor: null,
};

/** The real route table, so the assertion covers strings the application actually renders. */
function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  server.use(http.get('/api/transactions', () => HttpResponse.json(EMPTY_TRANSACTIONS)));

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={{ user: USER, logout: vi.fn() }}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/month'] })} />
      </AuthContext>
    </QueryClientProvider>,
  );
}

describe('changing the language at runtime', () => {
  it('re-renders the interface', async () => {
    renderShell();

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mês' })).toBeInTheDocument();

    await i18n.changeLanguage('en-US');

    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Month' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mês' })).not.toBeInTheDocument();
  });

  it('carries the new locale into money and dates', async () => {
    const july = new Date(2026, 6, 15);

    expect(formatCents(123456)).toBe('1.234,56 €');
    expect(formatMonth(july)).toBe('Julho de 2026');

    await i18n.changeLanguage('en-US');

    expect(formatCents(123456)).toBe('1,234.56 €');
    expect(formatMonth(july)).toBe('July 2026');
  });
});

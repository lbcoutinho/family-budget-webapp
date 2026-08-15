import { type CategoryDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CategorySelect } from './category-select';

import { server } from '@/test/server';

const now = '2026-01-01T00:00:00.000Z';

const RENDA: CategoryDto = {
  id: 'c1',
  parentId: 'r1',
  name: 'Renda',
  kind: 'EXPENSE',
  color: null,
  isActive: true,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};
const OUTROS: CategoryDto = {
  id: 'c2',
  parentId: 'r1',
  name: 'Outros',
  kind: 'EXPENSE',
  color: null,
  isActive: true,
  sortOrder: 1,
  createdAt: now,
  updatedAt: now,
};
const HABITACAO: CategoryDto = {
  id: 'r1',
  parentId: null,
  name: 'Habitação',
  kind: 'EXPENSE',
  color: '#3b82f6',
  isActive: true,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
  children: [RENDA, OUTROS],
};
const SALARIO: CategoryDto = {
  id: 'r2',
  parentId: null,
  name: 'Salário',
  kind: 'INCOME',
  color: '#22c55e',
  isActive: true,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
  children: [],
};

function Harness({
  kind,
  initialCategoryId,
  initialSubcategoryId,
  onChange,
}: {
  kind: 'EXPENSE' | 'INCOME';
  initialCategoryId?: string;
  initialSubcategoryId?: string;
  onChange: (categoryId: string | undefined, subcategoryId: string | undefined) => void;
}) {
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);

  return (
    <CategorySelect
      kind={kind}
      categoryId={categoryId}
      subcategoryId={subcategoryId}
      onChange={(nextCategoryId, nextSubcategoryId) => {
        setCategoryId(nextCategoryId);
        setSubcategoryId(nextSubcategoryId);
        onChange(nextCategoryId, nextSubcategoryId);
      }}
    />
  );
}

function renderSelect(props: Omit<Parameters<typeof Harness>[0], 'onChange'> & { onChange?: Parameters<typeof Harness>[0]['onChange'] }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onChange = props.onChange ?? vi.fn();

  return {
    user: userEvent.setup(),
    onChange,
    ...render(
      <QueryClientProvider client={queryClient}>
        <Harness {...props} onChange={onChange} />
      </QueryClientProvider>,
    ),
  };
}

describe('CategorySelect', () => {
  it('renders only roots matching kind, and keeps subcategory disabled until a category is chosen', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([HABITACAO, SALARIO])));

    renderSelect({ kind: 'EXPENSE' });

    await user_click_category();
    expect(await screen.findByRole('option', { name: 'Habitação' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Salário' })).not.toBeInTheDocument();

    await userEvent.setup().keyboard('{Escape}');
    expect(screen.getByRole('combobox', { name: 'Subcategoria' })).toBeDisabled();
  });

  it('choosing a category enables and populates the subcategory select', async () => {
    server.use(http.get('/api/categories', () => HttpResponse.json([HABITACAO])));

    const { user } = renderSelect({ kind: 'EXPENSE' });

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await user.click(await screen.findByRole('option', { name: 'Habitação' }));

    const subcategory = screen.getByRole('combobox', { name: 'Subcategoria' });
    expect(subcategory).not.toBeDisabled();

    await user.click(subcategory);
    expect(await screen.findByRole('option', { name: 'Renda' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Outros' })).toBeInTheDocument();
  });

  it('changing category clears the subcategory and reports no subcategory', async () => {
    const OUTRA: CategoryDto = { ...HABITACAO, id: 'r3', name: 'Outra', children: [] };
    server.use(http.get('/api/categories', () => HttpResponse.json([HABITACAO, OUTRA])));

    const { user, onChange } = renderSelect({ kind: 'EXPENSE', initialCategoryId: 'r1', initialSubcategoryId: 'c1' });

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    await user.click(await screen.findByRole('option', { name: 'Outra' }));

    expect(onChange).toHaveBeenCalledWith('r3', undefined);
  });

  it('does not offer an inactive category when creating a new entry', async () => {
    server.use(
      http.get('/api/categories', () => HttpResponse.json([{ ...HABITACAO, isActive: false }, SALARIO].filter((c) => c.kind === 'EXPENSE' && c.isActive))),
    );

    renderSelect({ kind: 'EXPENSE' });

    await user_click_category();
    expect(screen.queryByRole('option', { name: /Habitação/ })).not.toBeInTheDocument();
  });

  it('renders an inactive selected root suffixed and still selected while editing', async () => {
    const inactiveRoot = { ...HABITACAO, isActive: false };
    server.use(http.get('/api/categories', () => HttpResponse.json([inactiveRoot])));

    renderSelect({ kind: 'EXPENSE', initialCategoryId: 'r1', initialSubcategoryId: 'c1' });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Habitação (inativa)');
    });
  });

  it('falls back to fetching a subcategory whose root is still active but that itself was deactivated', async () => {
    const inactiveRenda = { ...RENDA, isActive: false };
    const rootWithoutInactiveChild = { ...HABITACAO, children: [OUTROS] };
    server.use(
      http.get('/api/categories', () => HttpResponse.json([rootWithoutInactiveChild])),
      http.get('/api/categories/:id', ({ params }) => (params.id === 'c1' ? HttpResponse.json(inactiveRenda) : HttpResponse.json(null, { status: 404 }))),
    );

    renderSelect({ kind: 'EXPENSE', initialCategoryId: 'r1', initialSubcategoryId: 'c1' });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Subcategoria' })).toHaveTextContent('Renda (inativa)');
    });
  });

  it('keeps other inactive rows unselectable while the current selection stays enabled', async () => {
    const selectedInactiveRoot = { ...HABITACAO, isActive: false };
    const otherInactiveRoot: CategoryDto = { ...HABITACAO, id: 'r3', name: 'Outra', isActive: false, children: [] };
    server.use(http.get('/api/categories', () => HttpResponse.json([selectedInactiveRoot, otherInactiveRoot])));

    const { user } = renderSelect({ kind: 'EXPENSE', initialCategoryId: 'r1' });

    await user.click(screen.getByRole('combobox', { name: 'Categoria' }));
    expect(await screen.findByRole('option', { name: /^Outra/ })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('option', { name: /^Habitação/ })).not.toHaveAttribute('data-disabled');
  });

  function user_click_category() {
    return userEvent.setup().click(screen.getByRole('combobox', { name: 'Categoria' }));
  }
});

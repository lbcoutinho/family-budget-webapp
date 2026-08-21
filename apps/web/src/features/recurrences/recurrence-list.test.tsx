import { type AccountDto, type CategoryDto, type RecurrenceRuleDto } from '@family-budget/api-client';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecurrenceList } from './recurrence-list';

import { TooltipProvider } from '@/components/ui/tooltip';

const ACCOUNT: AccountDto = {
  id: 'acc-1',
  name: 'Millennium',
  initialBalance: 0,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const CATEGORY: CategoryDto = {
  id: 'cat-1',
  parentId: null,
  name: 'Transporte',
  kind: 'EXPENSE',
  color: '#ff8800',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  children: [],
};

function rule(overrides: Partial<RecurrenceRuleDto> = {}): RecurrenceRuleDto {
  return {
    id: 'rule-1',
    type: 'EXPENSE',
    amount: 6250,
    description: 'Seguro do carro',
    notes: null,
    accountId: ACCOUNT.id,
    categoryId: CATEGORY.id,
    subcategoryId: null,
    frequency: 'MONTHLY',
    interval: 1,
    dayOfMonth: 10,
    startDate: '2026-01-10',
    endDate: null,
    totalOccurrences: null,
    totalAmount: null,
    autoConfirm: true,
    isActive: true,
    generatedUntil: '2026-08-10',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const noop = vi.fn();

describe('RecurrenceList', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "sem fim" for an open-ended rule and hides the progress bar', () => {
    render(
      <TooltipProvider>
        <RecurrenceList
          rules={[rule()]}
          accounts={[ACCOUNT]}
          categories={[CATEGORY]}
          onEdit={noop}
          onGenerate={noop}
          onDeactivate={noop}
          onCancelInstallments={noop}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('sem fim')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
  });

  it('shows an n/total progress fraction and amount owed for an installment plan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15));

    const plan = rule({ id: 'plan-1', totalOccurrences: 12, endDate: '2026-12-10', generatedUntil: '2026-12-10' });

    render(
      <TooltipProvider>
        <RecurrenceList
          rules={[plan]}
          accounts={[ACCOUNT]}
          categories={[CATEGORY]}
          onEdit={noop}
          onGenerate={noop}
          onDeactivate={noop}
          onCancelInstallments={noop}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText((_, node) => node?.textContent === '4/12')).toBeInTheDocument();
  });

  it('offers deactivate for an active open-ended rule and cancel-installments for a plan', () => {
    const plan = rule({ id: 'plan-1', description: 'Colchão Ikea', totalOccurrences: 3 });

    render(
      <TooltipProvider>
        <RecurrenceList
          rules={[rule(), plan]}
          accounts={[ACCOUNT]}
          categories={[CATEGORY]}
          onEdit={noop}
          onGenerate={noop}
          onDeactivate={noop}
          onCancelInstallments={noop}
        />
      </TooltipProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Desativar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Cancelar parcelas futuras' })).toHaveLength(1);
    // An installment plan has no edit UI (it's materialized in full at creation, ADR-0014) —
    // only the endless rule offers "Editar".
    expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(1);
  });

  it('hides every action for an inactive rule — no reactivate or delete exists on this screen', () => {
    render(
      <TooltipProvider>
        <RecurrenceList
          rules={[rule({ isActive: false })]}
          accounts={[ACCOUNT]}
          categories={[CATEGORY]}
          onEdit={noop}
          onGenerate={noop}
          onDeactivate={noop}
          onCancelInstallments={noop}
        />
      </TooltipProvider>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('inativa')).toBeInTheDocument();
  });

  it('shows the draft badge for a rule that does not auto-confirm', () => {
    render(
      <TooltipProvider>
        <RecurrenceList
          rules={[rule({ autoConfirm: false, amount: null })]}
          accounts={[ACCOUNT]}
          categories={[CATEGORY]}
          onEdit={noop}
          onGenerate={noop}
          onDeactivate={noop}
          onCancelInstallments={noop}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('gera rascunho')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

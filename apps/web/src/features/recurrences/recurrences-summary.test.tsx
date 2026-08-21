import { type RecurrenceRuleDto } from '@family-budget/api-client';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecurrencesSummary } from './recurrences-summary';

function rule(overrides: Partial<RecurrenceRuleDto> = {}): RecurrenceRuleDto {
  return {
    id: 'rule-1',
    type: 'EXPENSE',
    amount: 95000,
    description: 'Renda',
    notes: null,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    subcategoryId: null,
    frequency: 'MONTHLY',
    interval: 1,
    dayOfMonth: 1,
    startDate: '2026-01-01',
    endDate: null,
    totalOccurrences: null,
    autoConfirm: true,
    isActive: true,
    generatedUntil: '2026-08-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('RecurrencesSummary', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sums recurring expense and income for the current month, and finds the next generation date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15));

    const expense = rule({ id: 'e1', type: 'EXPENSE', amount: 95000, dayOfMonth: 1, generatedUntil: '2026-08-01' });
    const income = rule({ id: 'i1', type: 'INCOME', amount: 320000, dayOfMonth: 3, generatedUntil: '2026-08-01' });

    render(<RecurrencesSummary rules={[expense, income]} />);

    expect(screen.getByText('Despesas recorrentes em agosto')).toBeInTheDocument();
    expect(screen.getByText('− 950,00 €')).toBeInTheDocument();
    expect(screen.getByText('Receitas recorrentes em agosto')).toBeInTheDocument();
    expect(screen.getByText('+ 3.200,00 €')).toBeInTheDocument();
  });

  it('sums only what remains unpaid across installment plans, excluding open-ended rules', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 15));

    const plan = rule({ id: 'plan-1', totalOccurrences: 12, endDate: '2026-12-10', dayOfMonth: 10, startDate: '2026-01-10', amount: 5000 });
    const endless = rule({ id: 'endless-1' });

    render(<RecurrencesSummary rules={[plan, endless]} />);

    expect(screen.getByText('Parcelas em aberto')).toBeInTheDocument();
    // 4 of 12 elapsed by 2026-04-15, 8 remain.
    expect(screen.getByText('400,00 €')).toBeInTheDocument();
  });
});

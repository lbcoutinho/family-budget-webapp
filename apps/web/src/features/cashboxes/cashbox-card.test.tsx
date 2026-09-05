import { type CashboxDto } from '@family-budget/api-client';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CashboxCard } from './cashbox-card';

import { TooltipProvider } from '@/components/ui/tooltip';

const cashbox: CashboxDto = {
  id: '1',
  name: 'Férias 2027',
  description: 'Duas semanas na Grécia, em julho',
  targetAmount: 5_000_00,
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function renderCard(props: Partial<React.ComponentProps<typeof CashboxCard>> = {}) {
  return render(
    <TooltipProvider>
      <CashboxCard cashbox={cashbox} balance={null} onEdit={vi.fn()} onDeactivate={vi.fn()} onActivate={vi.fn()} onDelete={vi.fn()} {...props} />
    </TooltipProvider>,
  );
}

describe('CashboxCard', () => {
  it('renders a balance label and no progress UI without a target', () => {
    renderCard({ cashbox: { ...cashbox, targetAmount: null }, balance: 2_300_00 });

    expect(screen.getByText('Saldo')).toBeInTheDocument();
    expect(screen.getByText('2.300,00 €')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('treats a zero target as no target', () => {
    renderCard({ cashbox: { ...cashbox, targetAmount: 0 }, balance: 2_300_00 });

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/meta/i)).not.toBeInTheDocument();
  });

  it('renders the progress bar against the target once the balance is known', () => {
    renderCard({ balance: 2_300_00 });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '46');
  });

  it('shows actual progress above the target while capping the visual bar', () => {
    renderCard({ balance: 6_000_00 });

    expect(screen.getByText('120% da meta')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('keeps balance and progress visible for an inactive cashbox', () => {
    renderCard({ cashbox: { ...cashbox, isActive: false }, balance: 2_300_00 });

    expect(screen.getByText('inativa')).toBeInTheDocument();
    expect(screen.getByText('2.300,00 €')).toBeInTheDocument();
    expect(screen.getByText('46% da meta')).toBeInTheDocument();
  });
});

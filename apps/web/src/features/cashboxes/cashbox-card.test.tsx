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
  // Tripwire: once M4-T07 wires a real balance the page will stop passing `null` here for a
  // cashbox with a target, and this test should be updated to reflect that new reality.
  it('renders an em dash and no progress bar when the balance is not computed yet', () => {
    renderCard({ balance: null });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders the progress bar against the target once the balance is known', () => {
    renderCard({ balance: 2_300_00 });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '46');
  });

  it('shows the goal-reached state once the balance meets or exceeds the target', () => {
    renderCard({ balance: 6_000_00 });

    expect(screen.getByText('Meta atingida')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

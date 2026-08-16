import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Total guardado" value="4.150,00 €" />);

    expect(screen.getByText('Total guardado')).toBeInTheDocument();
    expect(screen.getByText('4.150,00 €')).toBeInTheDocument();
  });

  it('shows a skeleton instead of the value while loading', () => {
    const { container } = render(<StatCard label="Total guardado" value={undefined} loading />);

    expect(screen.getByText('Total guardado')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it('shows an em dash instead of the value on error', () => {
    render(<StatCard label="Total guardado" value={undefined} error />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

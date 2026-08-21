import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OccurrencePreview } from './occurrence-preview';

describe('OccurrencePreview', () => {
  it('shows a loading state', () => {
    render(<OccurrencePreview rows={[]} loading emptyMessage="empty" />);

    expect(screen.getByText('Calculando…')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    render(<OccurrencePreview rows={[]} error="boom" emptyMessage="empty" />);

    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('shows the empty message when there are no rows', () => {
    render(<OccurrencePreview rows={[]} emptyMessage="Nenhuma ocorrência com esses valores." />);

    expect(screen.getByText('Nenhuma ocorrência com esses valores.')).toBeInTheDocument();
  });

  it('paints a clamped row and renders the footer', () => {
    render(
      <OccurrencePreview
        rows={[
          { date: new Date(2026, 0, 31), amountCents: -9500, note: 'reference January/2026' },
          { date: new Date(2026, 1, 28), amountCents: -9500, clamped: true, note: 'adjusted' },
        ]}
        emptyMessage="empty"
        footerNote="Next 2 occurrences"
        footerTotal="190,00 €"
      />,
    );

    expect(screen.getByText('reference January/2026')).toBeInTheDocument();
    expect(screen.getByText('adjusted')).toBeInTheDocument();
    expect(screen.getByText('Next 2 occurrences')).toBeInTheDocument();
    expect(screen.getByText('190,00 €')).toBeInTheDocument();
  });
});

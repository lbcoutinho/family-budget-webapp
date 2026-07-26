import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './landing-page';

// Smoke test: the landing page renders inside the app-level providers without throwing.
describe('LandingPage', () => {
  it('renders the app title and a styled call to action', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Family Budget')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Say hello' })).toBeInTheDocument();
  });
});

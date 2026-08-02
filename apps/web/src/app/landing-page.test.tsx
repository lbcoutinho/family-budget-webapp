import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './landing-page';

import { AuthContext } from '@/features/auth/auth-context';

// Smoke test: the landing page renders for a signed-in user. The session plumbing behind it is
// covered by `features/auth/auth-flow.test.tsx`.
describe('LandingPage', () => {
  it('greets the signed-in user and offers a way out', () => {
    render(
      <MemoryRouter>
        <AuthContext value={{ user: { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís' }, logout: () => Promise.resolve() }}>
          <LandingPage />
        </AuthContext>
      </MemoryRouter>,
    );

    expect(screen.getByText('Olá, Luís.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});

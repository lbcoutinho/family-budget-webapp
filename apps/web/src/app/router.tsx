import { createBrowserRouter } from 'react-router-dom';

import { LandingPage } from './landing-page';

import { LoginPage } from '@/features/auth/login-page';
import { ProtectedRoute } from '@/features/auth/protected-route';

// Feature routes are mounted here as milestones land. Everything except `/login` is behind
// `ProtectedRoute`; a new route is protected unless it is deliberately opted out.
//
// Exported apart from the router itself so tests can mount the same route table on a memory
// history — a test asserting on a redirect should exercise the real routes, not a copy of them.
export const routes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <LandingPage />
      </ProtectedRoute>
    ),
  },
];

export const router = createBrowserRouter(routes);

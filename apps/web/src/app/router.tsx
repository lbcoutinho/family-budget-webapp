import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { NotFoundPlaceholder, RoutePlaceholder } from '@/components/layout/route-placeholder';
import { AccountsPage } from '@/features/accounts/accounts-page';
import { LoginPage } from '@/features/auth/login-page';
import { ProtectedRoute } from '@/features/auth/protected-route';

// Everything except `/login` renders inside the shell, and everything inside the shell is behind
// `ProtectedRoute` — a new route is protected unless it is deliberately opted out.
//
// Every navigable route exists from here on, because navigation that leads nowhere is not
// navigation; each one holds a placeholder until its own ticket replaces the element. They do not
// arrive in the order they are listed — accounts, categories and cashboxes come next, in M3.
//
// Exported apart from the router itself so tests can mount the same route table on a memory
// history — a test asserting on a redirect should exercise the real routes, not a copy of them.
export const routes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      // No dashboard: the month screen is this application's home, and the balance panel sits at
      // the top of it.
      { index: true, element: <Navigate to="/month" replace /> },
      { path: 'month', element: <RoutePlaceholder titleKey="nav.month" ticket="M5-T01" /> },
      { path: 'cashboxes', element: <RoutePlaceholder titleKey="nav.cashboxes" ticket="M3-T09" /> },
      { path: 'reports', element: <RoutePlaceholder titleKey="nav.reports" ticket="M6-T03" /> },
      { path: 'voice', element: <RoutePlaceholder titleKey="nav.voice" ticket="M8-T04" /> },
      { path: 'recurrences', element: <RoutePlaceholder titleKey="nav.recurrences" ticket="M7-T06" /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'categories', element: <RoutePlaceholder titleKey="nav.categories" ticket="M3-T08" /> },
      // A mistyped address lands inside the shell rather than on the router's own error page, so
      // the navigation is right there to recover with.
      { path: '*', element: <NotFoundPlaceholder /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './auth-context';

/**
 * Gate for anything that needs a session. No loading branch here on purpose: `AuthProvider` holds
 * the whole tree back until the silent refresh has answered, so by the time this renders `user` is
 * the final answer rather than "not yet known".
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const monthPrototype = !import.meta.env.PROD && pathname.startsWith('/month/') && new URLSearchParams(search).has('variant');

  if (user === null && !monthPrototype) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

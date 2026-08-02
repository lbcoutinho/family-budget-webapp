import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from './auth-context';

/**
 * Gate for anything that needs a session. No loading branch here on purpose: `AuthProvider` holds
 * the whole tree back until the silent refresh has answered, so by the time this renders `user` is
 * the final answer rather than "not yet known".
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

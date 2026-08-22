import { type AuthUserDto } from '@family-budget/api-client';
import { createContext, useContext } from 'react';

/**
 * The session as the rest of the application sees it: who is logged in, and how to stop being
 * logged in. The access token is deliberately absent — it lives in `@family-budget/api-client`
 * and is applied by the request interceptor, so no component ever handles it.
 */
export interface AuthContextValue {
  /** `null` once the session has been checked and there is nobody signed in. */
  user: AuthUserDto | null;
  /** Absent only in focused component tests that provide the context directly. */
  isAdmin?: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be called inside <AuthProvider>');
  }

  return value;
}

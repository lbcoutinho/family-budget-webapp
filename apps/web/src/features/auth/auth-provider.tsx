import { type SessionDto, refresh, setAccessToken, setSessionExpiredHandler, useLogout } from '@family-budget/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import i18n, { isSupportedLocale } from '../../i18n';

import { AuthCard } from './auth-card';
import { AuthContext, type AuthContextValue } from './auth-context';

/**
 * The session lives in the query cache rather than in `useState` for two reasons: React Query
 * de-duplicates the restore attempt, so StrictMode's double mount cannot spend the refresh cookie
 * twice, and `login` can seed the result with `setQueryData` instead of a second round trip.
 */
export const SESSION_QUERY_KEY = ['auth', 'session'];

/**
 * One silent refresh at startup. The access token is deliberately not persisted anywhere a script
 * can read it (ADR-0011), so what survives a reload is the httpOnly refresh cookie — trading it
 * for a token is the whole of "am I still logged in?", and the answer carries the user, so no
 * separate "who am I" call is needed.
 *
 * Never rejects: a rejected refresh is not an error, it is the answer "nobody is logged in".
 */
async function restoreSession(): Promise<SessionDto | null> {
  try {
    const session = await refresh();

    setAccessToken(session.accessToken);

    return session;
  } catch {
    setAccessToken(null);

    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { mutateAsync: requestLogout } = useLogout();

  const { data: session, isPending } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: restoreSession,
    // The session is only ever changed from here — by login, by logout, or by the interceptor
    // giving up on a refresh. Refetching it on a window focus would just spend a cookie.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // The interceptor ends the session when a refresh fails; the app's job is to notice. Setting the
  // user to null is enough — `ProtectedRoute` reacts to it and sends the user to the login screen,
  // which is a router navigation rather than the full page load a redirect handler would do.
  //
  // ponytail: other cached queries survive an expiry. Harmless while auth is the only feature;
  // once real data is cached, remove every query but this one here.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, [queryClient]);

  // The session's locale wins over the pre-login guess (`resolveLocale()`'s `navigator.language`
  // fallback), so a second device wakes up in the account's language rather than the browser's.
  // Depends on `user?.locale` only, not `user`: swapping any other field must not re-trigger this.
  useEffect(() => {
    if (session?.user.locale !== i18n.language && isSupportedLocale(session?.user.locale ?? '')) {
      void i18n.changeLanguage(session.user.locale);
    }
  }, [session?.user.locale]);

  const logout = useCallback(async () => {
    try {
      // The cookie is the server's to clear; if the call fails the local session still ends, which
      // is what the user asked for.
      await requestLogout();
    } finally {
      setAccessToken(null);
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    }
  }, [queryClient, requestLogout]);

  const value = useMemo<AuthContextValue>(() => ({ user: session?.user ?? null, isAdmin: session?.isAdmin ?? false, logout }), [session, logout]);

  // Nothing routed renders until the answer is in, so an authenticated user reloading the page
  // never sees the login form flash past.
  if (isPending) {
    return <SessionChecking />;
  }

  return <AuthContext value={value}>{children}</AuthContext>;
}

function SessionChecking() {
  const { t } = useTranslation();

  return (
    <AuthCard>
      <output className="grid place-items-center gap-3 pt-[34px] pb-[30px] text-center">
        <Loader2Icon className="size-5 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">{t('auth.restoringSession')}</span>
      </output>
    </AuthCard>
  );
}

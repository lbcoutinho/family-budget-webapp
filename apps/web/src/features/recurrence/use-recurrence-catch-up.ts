import { getListAccountBalancesQueryKey, getListCashboxBalancesQueryKey, getListTransactionsQueryKey, useCatchUpRecurrences } from '@family-budget/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useAuth } from '../auth/auth-context';

import { getDailyExpensesQueryKey } from '@/features/transactions/daily-expense-strip';

const storageKey = (userId: string): string => `recurrence-catch-up:${userId}`;

/**
 * Login-triggered recurrence catch-up (#199): fires once per browser session, the moment the
 * session goes from absent to present — a fresh login, and a silent-refresh restore on reload
 * alike, since this hook only ever observes `user.id` becoming non-null for the first time.
 *
 * Fire-and-forget by design: mounted once in the authenticated shell, it never blocks rendering
 * and shows no spinner. A `sessionStorage` guard (rather than only the mount-tracking ref) is what
 * survives a full page reload and a React StrictMode double-mount alike, so the endpoint is never
 * called twice in the same tab.
 */
export function useRecurrenceCatchUp(): void {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const wasPresent = useRef(false);

  const { mutate } = useCatchUpRecurrences({
    mutation: {
      onSuccess: (result) => {
        if (result.failed.length > 0) {
          toast.error(t('recurrence.catchUp.error'));
        }

        if (result.created > 0) {
          toast.success(t('recurrence.catchUp.created', { count: result.created }));
          void queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListAccountBalancesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getListCashboxBalancesQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getDailyExpensesQueryKey() });
        }
      },
      onError: () => {
        toast.error(t('recurrence.catchUp.error'));
      },
    },
  });

  useEffect(() => {
    if (user === null || wasPresent.current) {
      wasPresent.current = user !== null;
      return;
    }

    wasPresent.current = true;

    const key = storageKey(user.id);
    if (sessionStorage.getItem(key)) {
      return;
    }
    sessionStorage.setItem(key, '1');

    mutate();
    // Runs only off the identity that defines "a session started" — every other field on `user`
    // (locale, name, …) must not refire it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

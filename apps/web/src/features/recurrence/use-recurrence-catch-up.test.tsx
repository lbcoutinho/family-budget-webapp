import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecurrenceCatchUp } from './use-recurrence-catch-up';

import type * as ApiClient from '@family-budget/api-client';

import { AuthContext } from '@/features/auth/auth-context';

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

interface MutationOptions {
  onSuccess?: (result: ApiClient.RecurrenceCatchUpResultDto) => void;
  onError?: () => void;
}

const mutate = vi.fn();
let mutationOptions: MutationOptions = {};

vi.mock('@family-budget/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    useCatchUpRecurrences: (options?: { mutation?: MutationOptions }) => {
      mutationOptions = options?.mutation ?? {};
      return { mutate };
    },
  };
});

const USER: ApiClient.AuthUserDto = { id: 'u1', email: 'luis@exemplo.pt', name: 'Luís Coutinho', locale: 'pt-BR' };

const result = (overrides: Partial<ApiClient.RecurrenceCatchUpResultDto> = {}): ApiClient.RecurrenceCatchUpResultDto => ({
  rulesProcessed: 1,
  created: 0,
  failed: [],
  skippedLocked: false,
  ...overrides,
});

let queryClient: QueryClient;

function Harness() {
  useRecurrenceCatchUp();
  return null;
}

const tree = (user: ApiClient.AuthUserDto | null) => (
  <QueryClientProvider client={queryClient}>
    <AuthContext value={{ user, logout: vi.fn() }}>
      <Harness />
    </AuthContext>
  </QueryClientProvider>
);

function renderCatchUp(user: ApiClient.AuthUserDto | null) {
  const { rerender, unmount } = render(tree(user));

  return { rerender: (nextUser: ApiClient.AuthUserDto | null) => rerender(tree(nextUser)), unmount };
}

describe('useRecurrenceCatchUp', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mutate.mockClear();
    toastSuccess.mockClear();
    toastError.mockClear();
    sessionStorage.clear();
  });

  it('does not fire while there is no session', () => {
    renderCatchUp(null);

    expect(mutate).not.toHaveBeenCalled();
  });

  it('fires once when the session goes from absent to present', () => {
    const { rerender } = renderCatchUp(null);

    rerender(USER);

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('fires on the very first render when the session is already present (a restore on reload)', () => {
    renderCatchUp(USER);

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('does not refire on a re-render or on an unrelated user-field change', () => {
    const { rerender } = renderCatchUp(USER);
    expect(mutate).toHaveBeenCalledTimes(1);

    rerender(USER);
    rerender({ ...USER, locale: 'en-US' });

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('does not refire on a second mount within the same browser session', () => {
    const { unmount } = renderCatchUp(USER);
    expect(mutate).toHaveBeenCalledTimes(1);

    unmount();
    renderCatchUp(USER);

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('shows the pluralized toast and invalidates queries when created > 0', () => {
    renderCatchUp(USER);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mutationOptions.onSuccess?.(result({ created: 3 }));

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess.mock.calls[0]?.[0]).toContain('3');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('shows nothing when created === 0', () => {
    renderCatchUp(USER);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mutationOptions.onSuccess?.(result({ created: 0 }));

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('shows an error toast when a rule failed, even with created === 0', () => {
    renderCatchUp(USER);

    mutationOptions.onSuccess?.(result({ created: 0, failed: [{ ruleId: 'r1', message: 'boom' }] }));

    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when the call is rejected, without throwing', () => {
    renderCatchUp(USER);

    expect(() => mutationOptions.onError?.()).not.toThrow();
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});

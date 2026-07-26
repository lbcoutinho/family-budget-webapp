import { HealthStatusDtoStatus, useGetHealth, type HealthStatusDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, expectTypeOf, it } from 'vitest';

// Proves the generated client is consumable from the web app with correct typing: the health hook
// mounts inside a QueryClientProvider, and its `data` is the generated `HealthStatusDto` type.
describe('generated api-client', () => {
  it('exposes a typed React Query hook for the health endpoint', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useGetHealth(), { wrapper });

    // No network in jsdom, so the query is still pending — enough to prove the hook wires up.
    expect(result.current.isPending).toBe(true);
    expectTypeOf(result.current.data).toEqualTypeOf<HealthStatusDto | undefined>();
    expect(HealthStatusDtoStatus.ok).toBe('ok');
  });
});

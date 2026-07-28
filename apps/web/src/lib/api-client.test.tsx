import { HealthStatusDtoDb, HealthStatusDtoStatus, useGetHealth, type HealthStatusDto } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { server } from '@/test/server';

// Proves the generated client is consumable from the web app with correct typing: the health hook
// mounts inside a QueryClientProvider, and its `data` is the generated `HealthStatusDto` type.
describe('generated api-client', () => {
  it('exposes a typed React Query hook for the health endpoint', () => {
    // The suite answers only what a test handles (see `test/setup.ts`), so the request the hook
    // fires needs somewhere to land even though the assertions below run before it settles.
    server.use(http.get('/api/health', () => HttpResponse.json({ status: HealthStatusDtoStatus.ok, db: HealthStatusDtoDb.up })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    const { result } = renderHook(() => useGetHealth(), { wrapper });

    // No network in jsdom, so the query is still pending — enough to prove the hook wires up.
    expect(result.current.isPending).toBe(true);
    expectTypeOf(result.current.data).toEqualTypeOf<HealthStatusDto | undefined>();
    expect(HealthStatusDtoStatus.ok).toBe('ok');
  });
});

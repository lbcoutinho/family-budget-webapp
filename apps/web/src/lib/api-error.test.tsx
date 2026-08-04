import { useDeactivateCategory } from '@family-budget/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { apiErrorMessage } from './api-error';

import i18n from '@/i18n';
import { server } from '@/test/server';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
);

/** Fires a real request through the generated client so the assertion runs on a real axios error. */
async function errorFrom(body: { statusCode: number; code: string; message: string }): Promise<unknown> {
  server.use(http.patch('/api/categories/:id/deactivate', () => HttpResponse.json(body, { status: 409 })));

  const { result } = renderHook(() => useDeactivateCategory(), { wrapper });
  result.current.mutate({ id: 'c1' });
  await waitFor(() => expect(result.current.isError).toBe(true));

  return result.current.error;
}

describe('apiErrorMessage', () => {
  it('translates a known error code', async () => {
    const error = await errorFrom({ statusCode: 409, code: 'CATEGORY_LAST_ACTIVE_SUBCATEGORY', message: 'This is the last active subcategory.' });

    expect(apiErrorMessage(error, i18n.t)).toBe(i18n.t('errors.CATEGORY_LAST_ACTIVE_SUBCATEGORY'));
  });

  it('falls back to the generic message for an unknown code, never to the API English', async () => {
    const error = await errorFrom({ statusCode: 409, code: 'SOMETHING_THE_WEB_DOES_NOT_KNOW_YET', message: 'Business rule violated.' });

    expect(apiErrorMessage(error, i18n.t)).toBe(i18n.t('errors.UNKNOWN'));
  });

  it('falls back for an error that carries no body at all', () => {
    expect(apiErrorMessage(new Error('Network Error'), i18n.t)).toBe(i18n.t('errors.UNKNOWN'));
  });
});

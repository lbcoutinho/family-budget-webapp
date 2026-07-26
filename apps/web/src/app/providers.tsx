import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';

import { Toaster } from '@/components/ui/sonner';

// One QueryClient per app instance, held in state so hot-reload and React StrictMode's double
// render don't discard the cache by recreating it on every render.
export function Providers() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}

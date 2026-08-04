import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';

import { router } from './router';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/features/auth/auth-provider';

// One QueryClient per app instance, held in state so hot-reload and React StrictMode's double
// render don't discard the cache by recreating it on every render.
export function Providers() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {/* Outside the router: the session has to be settled before any route decides whether it is
          allowed to render, and the provider needs no route of its own to do it. */}
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

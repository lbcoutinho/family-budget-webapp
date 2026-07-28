import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Providers } from '@/app/providers';
import { installSessionExpiredRedirect } from '@/lib/session';

import './styles/index.css';

// Before anything renders: a request that outlives its session must find somewhere to send the
// user, even if it is the very first request the app makes.
installSessionExpiredRedirect();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
);

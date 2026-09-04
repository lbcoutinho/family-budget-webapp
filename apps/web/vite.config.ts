/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API serves everything under the global `/api` prefix (see apps/api main.ts), so the dev
// server proxies that path straight through to the backend port and the browser never sees a
// cross-origin request.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    fileParallelism: false,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
      // TODO(M4.1-T01): raise to the 70/60/70/70 target — baseline already clears it
      // (statements 81.18%, branches 80%, functions 76.1%, lines 81.34%), floors just lock it in.
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});

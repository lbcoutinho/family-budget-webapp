import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      exclude: ['src/**/*.spec.ts', 'src/generated/**'],
      thresholds: { statements: 45, branches: 60, functions: 60, lines: 45 },
    },
  },
});

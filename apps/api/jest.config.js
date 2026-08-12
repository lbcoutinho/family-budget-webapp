/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // Override `module` to CommonJS so ts-jest runs under Node's default require semantics,
    // regardless of the Node16 module setting the app itself compiles with.
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS' } }],
  },
  testEnvironment: 'node',
  // The generated Prisma client (ADR-0017) lives under src/ but is build output: never covered.
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!generated/**'],
  coverageDirectory: '../coverage',
  coverageReporters: ['text-summary', 'lcov'],
  // TODO(M4.1-T01): raise to the 70/60/70/70 target once coverage catches up; these floors just
  // freeze the measured baseline (statements 46.01%, branches 79.59%, functions 61.17%, lines 46.14%).
  coverageThreshold: {
    global: {
      statements: 45,
      branches: 60,
      functions: 60,
      lines: 45,
    },
  },
};

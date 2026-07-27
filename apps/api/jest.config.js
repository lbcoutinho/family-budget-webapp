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
};

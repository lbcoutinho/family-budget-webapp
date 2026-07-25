// Flat ESLint config for the whole monorepo. A single config linted in one pass from the
// repository root, with per-workspace overrides below, so that `apps/api` gets NestJS-shaped
// rules and `apps/web` gets React-shaped ones without duplicating the shared base.
//
// CommonJS on purpose: the root package.json has no `"type": "module"`, and every plugin used
// here ships CommonJS.

const js = require('@eslint/js');
const prettier = require('eslint-config-prettier/flat');
const importPlugin = require('eslint-plugin-import');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');
const tseslint = require('typescript-eslint');

/** File extensions carrying TypeScript, i.e. everything that gets type-aware linting. */
const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const JS_FILES = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'];

module.exports = tseslint.config(
  // ---------------------------------------------------------------------------------------
  // Ignores. Flat config replaced `.eslintignore`, which ESLint 9 no longer reads.
  // ---------------------------------------------------------------------------------------
  {
    name: 'family-budget/ignores',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '.husky/_/**',
      // Orval output: generated code is never hand-edited, so it is never linted (M1-T07).
      'packages/api-client/**',
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Shared base: applies to every linted file in the repository.
  // ---------------------------------------------------------------------------------------
  {
    name: 'family-budget/base',
    files: [...TS_FILES, ...JS_FILES],
    extends: [js.configs.recommended, importPlugin.flatConfigs.recommended],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'object-shorthand': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  // ---------------------------------------------------------------------------------------
  // TypeScript, type-aware. `projectService` resolves each file against the nearest
  // tsconfig.json, which is what makes `no-floating-promises` (critical for NestJS) work.
  // ---------------------------------------------------------------------------------------
  {
    name: 'family-budget/typescript',
    files: TS_FILES,
    extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked, importPlugin.flatConfigs.typescript],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    settings: {
      // No explicit `project`: the resolver discovers the nearest tsconfig.json per file,
      // which is what a monorepo with one tsconfig per workspace wants.
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      // The whole reason this project stays on a TypeScript version with a JS compiler API.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // TypeScript already resolves modules; the import plugin only duplicates the work
      // (and mis-resolves path aliases).
      'import/no-unresolved': 'off',
      'import/named': 'off',
    },
  },

  // ---------------------------------------------------------------------------------------
  // apps/api — NestJS on Node.
  // ---------------------------------------------------------------------------------------
  {
    name: 'family-budget/api',
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // NestJS modules, DTOs and Prisma models are classes carrying only decorators.
      '@typescript-eslint/no-extraneous-class': 'off',
      // Decorator metadata relies on parameter properties and empty constructors.
      '@typescript-eslint/no-useless-constructor': 'off',
    },
  },
  {
    name: 'family-budget/api-tests',
    files: ['apps/api/**/*.spec.ts', 'apps/api/**/*.e2e-spec.ts', 'apps/api/test/**/*.ts'],
    languageOptions: {
      globals: globals.jest,
    },
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // ---------------------------------------------------------------------------------------
  // apps/web — React in the browser.
  // ---------------------------------------------------------------------------------------
  {
    name: 'family-budget/web',
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
    },
  },

  // ---------------------------------------------------------------------------------------
  // Plain JavaScript: config files at the root and inside workspaces. These are outside every
  // tsconfig, so type-aware rules must be switched off for them.
  // ---------------------------------------------------------------------------------------
  {
    name: 'family-budget/javascript',
    files: JS_FILES,
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // ---------------------------------------------------------------------------------------
  // Must stay last: turns off every rule Prettier is responsible for.
  // ---------------------------------------------------------------------------------------
  prettier,
);

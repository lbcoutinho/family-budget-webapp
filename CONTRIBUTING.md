# Contributing

Setup, running the app and database instructions live in [`README.md`](README.md). This file
covers code style, tooling and conventions for anyone changing code in this repository.

## Code style

One ESLint flat config ([`eslint.config.js`](eslint.config.js)) covers the whole monorepo
and is run in a **single pass from the root**, rather than once per workspace. A single pass
is faster, and it also reaches the files that live outside any workspace — the root config
files themselves. The per-workspace differences (Node globals and NestJS allowances for
`apps/api`, browser globals plus `react-hooks` and `jsx-a11y` for `apps/web`) are expressed
as overrides inside that one config.

TypeScript is linted with **type information** (`projectService`), which is what makes
`@typescript-eslint/no-floating-promises` work — the rule that matters most once NestJS
arrives, since an unawaited promise there fails silently. `eslint-config-prettier` is applied
last, so ESLint never argues with Prettier about formatting.

Prettier deviates from its defaults in three places, in [`.prettierrc`](.prettierrc):
`singleQuote: true`, `trailingComma: "all"`, `printWidth: 160`. The plan asked for a
100-column width; 160 was chosen instead, so wide-but-readable lines (NestJS decorators,
Tailwind class lists, table-driven tests) stop being wrapped into unreadable stacks.

Two trees are excluded from both tools: `packages/api-client`, which Orval generates and
nobody edits, and — for Prettier only — `docs/adr/` and `plans/`, whose text is either
immutable once accepted or copied verbatim into GitHub Issues.

A Husky `pre-commit` hook runs `lint-staged` over the staged files: ESLint `--fix` followed
by Prettier on TypeScript and JavaScript, Prettier alone on JSON, Markdown, YAML and CSS. A
lint error that no autofix can repair aborts the commit. The hook is installed by the
`prepare` script, so a fresh `pnpm install` is all it takes; to bypass it deliberately, use
`git commit --no-verify`.

**ESLint is pinned to 9.x, not 10.x.** Two of the plugins this project requires —
`eslint-plugin-import` and `eslint-plugin-jsx-a11y` — still declare a peer range that stops
at ESLint 9. Following the same rule used for TypeScript below, the version chosen is the
newest one inside every peer range.

## TypeScript configuration

[`tsconfig.base.json`](tsconfig.base.json) holds the settings shared by every workspace —
`target: ES2022`, `strict: true`, `noUncheckedIndexedAccess: true` and the related
`noImplicitOverride` / `noFallthroughCasesInSwitch` / `noUnused*` checks. Each workspace
has its own `tsconfig.json` extending it and adding only what is specific to its runtime
(module system, `lib`, JSX, path aliases).

**TypeScript is pinned to 6.x, not 7.x.** TypeScript 7 is the native (Go) compiler: it ships
no JavaScript compiler API, and the tools this project depends on still need one —
`typescript-eslint` declares `typescript >=4.8.4 <6.1.0` and `ts-jest` declares
`>=4.3 <7`. Without them there is no type-aware linting (including
`@typescript-eslint/no-floating-promises`) and no NestJS test transform. The configuration
here is already free of what TypeScript 7 removed — no `baseUrl`, no `moduleResolution:
node10` — so the upgrade is a version bump once the toolchain catches up.

## MCP tooling

[`.mcp.json`](.mcp.json) declares project-scoped MCP servers picked up automatically by
Claude Code on clone — currently `codegraph` and `shadcn` (the
[shadcn-ui-mcp-server](https://github.com/Jpisnice/shadcn-ui-mcp-server), used to look up
shadcn/ui component source and demos).

`codegraph` needs its CLI installed globally and an index built once per clone — `.codegraph/`
holds the SQLite index and daemon files, is git-ignored (machine-local), and is empty right
after clone:

```bash
npm install -g @colbymchenry/codegraph
codegraph init      # builds the initial index at the repo root
```

`codegraph sync` catches the index up after pulling changes made outside a Claude Code session
(the running MCP server/hook keeps it current during one); `codegraph status` shows whether it's
stale.

The `shadcn` server needs a GitHub personal access token for API rate limits — no scopes
required. Export it in your shell before starting Claude Code, it is not read from `.env`:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
```

## Claude Opus code review

CI (lint, typecheck, tests, CodeQL, Gitleaks) catches mechanical issues but not design —
naming, domain-rule violations, dead abstractions, missing tests. `.github/workflows/claude-review.yml`
runs a Claude Opus `/review` pass against an open PR, on demand:

```bash
gh workflow run claude-review.yml -f pr_number=<N>
```

The review posts as a PR comment; it is not a required check and never blocks merge.
Re-dispatching the same PR cancels any in-flight review. Requires the `ANTHROPIC_API_KEY`
repo secret (Settings → Secrets and variables → Actions) — the workflow fails fast with a
clear message if it's missing.

## Conventions

- Money is always stored and transported as **integer cents** — never floats.
- All implementation happens on a branch off `main` and lands through a pull request;
  `main` is never committed to directly.
- English (en-US) for code, comments and commit messages; only UI strings are localized.

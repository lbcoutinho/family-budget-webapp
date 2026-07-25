---
name: dependency-review
description: Review every version this project pins — npm dependencies, @types/*, Node, pnpm, Docker images, GitHub Actions — and upgrade each one to the latest release that is compatible with the rest of the stack. Use this at the end of every milestone (M1, M2, …), and any time the user asks to check for newer versions, bump dependencies, update libraries or frameworks, or asks whether the project is running the latest version of something. Prefer this over ad-hoc bumping: the point is proving compatibility, not raising numbers.
---

# Dependency version review

Run this when a milestone closes, before the next one starts. Upgrading between milestones
keeps the diff small and attributable; upgrading in the middle of feature work means a
regression could come from either the feature or the bump, and you can no longer tell which.

The goal is **the newest version that actually works with everything else**, which is often not
the newest version published. Compatibility is proven, never assumed.

## 1. Inventory what is pinned

Versions hide in more places than `package.json`. Sweep all of them:

| Where | What |
|---|---|
| root + workspace `package.json` | `dependencies`, `devDependencies`, `packageManager`, `engines` |
| `.nvmrc` | Node major |
| `docker-compose.yml` | image tags (PostgreSQL, …) |
| `.github/workflows/*.yml` | action versions (`actions/checkout@vN`), service images |
| `apps/api/prisma/schema.prisma` | generator/client expectations |

## 2. Find what is available

```bash
npm view <pkg> dist-tags          # latest / next / beta
npm view <pkg> versions --json    # every published version, when you need a specific line
curl -s https://nodejs.org/dist/index.json   # Node releases with their LTS codename
```

Watch out: `dist-tags` can lie by omission — a stale `beta` tag once hid a stable release that
was newer than what the tag suggested. When a major looks missing, list the versions.

## 3. Prove compatibility before adopting

Two checks, in this order, because the first is cheap and rules out most bad upgrades:

**Read the peer ranges of whatever consumes the package.**

```bash
npm view <consumer> peerDependencies
```

A type-checker, a test transform and a linter all consume TypeScript, so all three constrain
it. The same holds for ESLint plugins, Jest transforms and Vite plugins.

**Then install it and run the suite** — `pnpm install`, `pnpm -r typecheck`, `pnpm lint`,
`pnpm test`. Satisfying a range and working are different claims; only the second one counts.

### When the newest major has no support yet

This is the common case for freshly released majors, and the answer is not "wait and forget".
Stay on the newest supported version **and remove whatever the next major drops**, so the
eventual bump is a version number rather than a migration.

The worked precedent from M1-T01: TypeScript 7 is the native Go compiler and ships no
JavaScript compiler API, while `typescript-eslint` requires `<6.1.0` and `ts-jest` requires
`<7` — adopting it would have cost type-aware linting (including `no-floating-promises`, which
this project depends on) and the NestJS Jest transform. So the project sits on TypeScript 6.x,
and the configs already dropped `baseUrl` and `moduleResolution: node10`, which 6 deprecates
and 7 removes.

### Versions that are pinned on purpose

Some numbers are decisions, not lag. Leave them alone unless the decision itself is changing:

- **`@types/node`** tracks the Node major in `.nvmrc` (ADR-0016) — types describing APIs the
  runtime does not have is worse than being a major behind.
- **PostgreSQL 16** (ADR-0002).
- Anything else an ADR fixes.

Changing one of these is an architectural decision: it needs a **new ADR** (never edit an
accepted one), plus the updates the ticket workflow in `CLAUDE.md` requires.

## 4. Land it

- **One commit for the upgrade**, separate from feature work, so a regression is easy to bisect
  and revert. Say in the message what moved and why the newest was or wasn't taken.
- **Record it in `MEMORY.md`** — what moved, and, more useful to the next ticket, what was
  deliberately *not* moved and why. Any config or API change an upgrade forced belongs there
  too, as a gotcha for whoever hits the same scaffold later.
- If an upgrade required a decision (a runtime major, a database version), write the ADR and
  update the affected plan text and issues so the mirroring stays in sync.

## Report back in this shape

A table beats prose here — the useful information is the gap between "latest" and "chosen".

```markdown
| Dependency | Current | Latest | Chosen | Why not latest |
|---|---|---|---|---|
| typescript | 6.0.3 | 7.0.2 | 6.0.3 | typescript-eslint <6.1.0, ts-jest <7 |
| pnpm | 11.17.0 | 11.17.0 | 11.17.0 | — |
```

Then state plainly what you verified (which commands, on which runtime) and anything you could
not verify, so the reader knows how much weight the table carries.

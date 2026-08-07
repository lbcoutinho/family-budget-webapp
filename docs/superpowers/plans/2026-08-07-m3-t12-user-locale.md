# M3-T12 — `locale` on `User` + `PATCH /api/users/me`

**Date:** 2026-08-07
**Ticket:** `plans/milestones/m03-master-data.md` § M3-T12, issue #72
**Design:** `docs/superpowers/specs/2026-08-04-i18n-design.md`
**Branch:** `feat/m3-t12-user-locale`

---

## Context

Language today is a browser setting: `apps/web/src/i18n/index.ts` resolves `localStorage['locale']
→ navigator.language → pt-BR`. It does not follow the account — a second device wakes up in the
wrong language, and there is nowhere to persist the choice the Settings › General screen (M3-T13)
will offer.

This ticket adds the missing storage and the endpoint that writes it: `User.locale`, carried in
the session response so the app boots in the right language without an extra round trip, and
`PATCH /api/users/me` to change it. It is issue
[#72](https://github.com/lbcoutinho/family-budget-webapp/issues/72), spec in
`plans/milestones/m03-master-data.md` §M3-T12 and `docs/superpowers/specs/2026-08-04-i18n-design.md`.

**Order warning:** the milestone's build order puts M3-T09 (Cashboxes screen, issue #53, still
open) before M3-T12. T12 has no dependency on T09, so building it now is safe — but it is a
deviation from the documented order and should be acknowledged.

No new ADR: ADR-0018 already decided the column-not-table shape and the resolution order.

## API

### 1. Schema + migration

`apps/api/prisma/schema.prisma`, `model User` (line 40):

```prisma
locale String @default("pt-BR")
```

One migration, `pnpm --filter api db:migrate` (name `add_user_locale`, matching the
`20260803135200_add_cashbox` convention). Existing rows take the default; `prisma/seed.ts` needs
no change for the same reason. **`prisma migrate reset` is user-run** — do not attempt it.

No enum in Postgres: the supported list lives in code (validation below), so adding a third locale
is a code change, not a migration.

### 2. Supported-locale list (API side)

The web's `SUPPORTED_LOCALES` (`apps/web/src/i18n/index.ts`) can't be imported by the API. Declare
the same list once in the API, next to the DTO that validates it:

```ts
export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;
```

Skipped: a shared `packages/locales` package — two entries in two places, and the parity is already
asserted by the e2e test below plus `locale-parity.test.ts` on the web.

### 3. Users module

New `apps/api/src/modules/users/` (directory exists, only holds `demo-email.ts`), mirroring the
shape of `apps/api/src/modules/accounts/`:

- `dto/update-user.dto.ts` — `locale?: string` with `@IsIn(SUPPORTED_LOCALES)` + `@IsOptional()` +
  `@ApiPropertyOptional({ type: String, enum: SUPPORTED_LOCALES })`. Only `locale` is writable;
  `name`/`email` are out of scope. **`type` must be stated explicitly** — the OpenAPI export runs
  under `tsx`, which emits no `design:type` metadata, and the swagger CLI plugin is off (the same
  note appears in `accounts/dto/account.dto.ts`). No `PartialType` here: one optional field.
  `whitelist: true, forbidNonWhitelisted: true` in `app.setup.ts` means an attempt to patch
  `name` or `email` is already a 400.
- `users.controller.ts` — `@ApiTags('users')`, `@Controller('users')`, one route:
  `@Patch('me')` with `@ApiOperation({ operationId: 'updateCurrentUser' })` and
  `@ApiOkResponse({ type: AuthUserDto })`. User id from the existing
  `@CurrentUser()` decorator (`modules/auth/decorators/current-user.decorator.ts`); the global
  `JwtAuthGuard` already protects anything not marked `@Public()`.
- `users.service.ts` — `prisma.user.update({ where: { id }, data, select: { id, email, name, locale } })`,
  returning an `AuthUserDto`. Field-by-field select, same reason as `AuthService.validateUser`:
  `passwordHash` must have no path into a response.
- `users.module.ts`, registered in `apps/api/src/app.module.ts`.

Global `ValidationPipe` (`app.setup.ts`) turns an unsupported locale into 400 with no extra code.

### 4. `AuthUserDto` carries the locale

`apps/api/src/modules/auth/dto/auth-user.dto.ts`: add
`@ApiProperty({ type: String, enum: SUPPORTED_LOCALES, example: 'pt-BR' }) locale!: string;`

Both places that build it must select the new column, or the app boots in the wrong language:

- `AuthService.validateUser` — `return { id, email, name, locale }` (login path).
- `AuthService.refreshSession` — add `locale: true` to the `select` (reload path).

Nothing else changes: `SessionDto` embeds `AuthUserDto`, and the JWT payload/`AuthenticatedUser`
stay id+email — the locale is not a claim, so changing it takes effect without re-issuing a token.

### 5. Regenerate the client

`pnpm gen` (OpenAPI export → Orval) — updates `packages/api-client/src/generated/model/authUserDto.ts`
and adds `useUpdateCurrentUser`. Generated files are never hand-edited; CI fails if stale.

## Web

Minimal: the session's locale must win, and there must be a way to write it back. **No UI** —
the picker is M3-T13, blocked on prototype `07-settings-general.html`.

### 6. Session locale fronts the mirror

`apps/web/src/features/auth/auth-provider.tsx` already holds the user in the TanStack Query cache
(`SESSION_QUERY_KEY`), fed by both the login mutation and `restoreSession()`. One effect there
covers both paths:

```ts
useEffect(() => {
  if (user && user.locale !== i18n.language && isSupportedLocale(user.locale)) {
    void i18n.changeLanguage(user.locale);
  }
}, [user?.locale]);
```

The existing `languageChanged` listener in `apps/web/src/i18n/index.ts` writes the `localStorage`
mirror, so nothing else is needed to keep the cache warm for the next boot. `resolveLocale()` is
untouched — it stays the pre-session answer (login screen, first paint), exactly as ADR-0018
describes.

Export a small `isSupportedLocale(value: string): value is SupportedLocale` guard from
`apps/web/src/i18n/index.ts` (the shape is already there in `resolveLocale`, this reuses it) and
update the stale `M3-T12` comment on `STORAGE_KEY`.

Skipped: a `useLocale()` hook or locale context — one effect, one call site. Add when a second
consumer appears.

## Tests

- **API unit** — `users.service.spec.ts`: update returns the DTO shape, no `passwordHash`.
- **API e2e** — new `apps/api/test/e2e/users.e2e-spec.ts`, following the `accounts.e2e-spec.ts`
  pattern (full `AppModule` + `configureApp`, argon2 fixture user, login for a real token, the
  `authed(method, path)` helper, fixtures deleted in `beforeEach`/`afterAll`): patch `locale` and
  read it back on a fresh login/refresh; an unsupported value (`'fr-FR'`, `''`, a number) is 400;
  a body with `name` is 400 (`forbidNonWhitelisted`); no token is 401. Note `user.e2e-spec.ts`
  already exists and is a different, model-level suite — leave it alone.
- **API e2e** — extend `auth.e2e-spec.ts`: the login and refresh responses carry `locale`. Check
  `openapi.e2e-spec.ts` still passes once the `users` tag joins the document.
- **Web integration** — `apps/web/src/features/auth/auth-flow.test.tsx` (or a sibling): with
  `navigator.language` stubbed to `en-US` and MSW returning a session whose `user.locale` is
  `pt-BR`, the interface renders pt-BR — the session wins over the browser. Handlers are declared
  inline per test, as everywhere in this suite.

## Docs & process

- GitHub issue #72 already exists — no `github-mirroring` run needed; comment on it only if a
  decision deviates from the ticket.
- Tick the acceptance criteria in `plans/milestones/m03-master-data.md` §M3-T12 when green.
- Branch off `main` (e.g. `feat/m3-t12-user-locale`), one PR, `create-pr` skill for the body.
  Never merge to `main`.

## Verification

```bash
docker compose up -d
pnpm --filter api db:migrate
pnpm gen
pnpm lint && pnpm -r typecheck && pnpm test
```

Then, manually: log in, `PATCH /api/users/me` with `{"locale":"en-US"}` (Swagger at `/api/docs`),
reload the app — interface comes up in English on a browser whose `navigator.language` is pt-BR,
and stays English after a logout/login. `{"locale":"fr-FR"}` answers 400.

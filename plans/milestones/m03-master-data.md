# M3 — Master data

**Goal:** full CRUD for accounts, categories and cashboxes, with deactivation, on both the API and the UI.

**Definition of done:** everything required to record transactions in M4 can be created through the interface.

**Depends on:** M2 complete.

## Execution order (T10 and T11 come before T07–T09)

T10–T14 were added after T01–T09 were already mirrored as GitHub issues, so their numbers continue
the sequence while their position in the work does not. **The order below is the order to build
in**; ask before deviating from it.

| Order | Ticket | Why here |
|---|---|---|
| 1 | M3-T10 | The i18n foundation has to exist before any screen is written, or the screen is written twice |
| 2 | M3-T11 | Error codes, so the screens can show a translated 409 rather than the API's English sentence |
| 3 | M3-T07, M3-T08, M3-T09 | The three master-data screens, written with `t()` from the start (each blocked on its own approved prototype) |
| 4 | M3-T12 | `locale` on `User` — needs the client to have somewhere to put it |
| 5 | M3-T13 | Settings › General, the screen that sets the preference |
| 6 | M3-T14 | Deploy, last: it deploys what the milestone built |

Design behind T10–T13: `docs/superpowers/specs/2026-08-04-i18n-design.md`.

---

## M3-T01 — `Account` model and migration

Done — see #45.

---

## M3-T02 — Accounts API with deactivation

Done — see #46.

---

## M3-T03 — `Category` model with hierarchy and partial index

Done — see #47.

---

## M3-T04 — Categories API with the two-level rule

Done — see #48.

---

## M3-T05 — `Cashbox` model and API

Done — see #49.

---

## M3-T06 — Base layout and navigation

Done — see #50.

---

## M3-T07 — Accounts screen

Done — see #51.

---

## M3-T08 — Categories screen

Done — see #52.

---

## M3-T09 — Cashboxes screen

Done — see #53.

---

## M3-T10 — i18n foundation on the web

Done — see #70.

---

## M3-T11 — Stable error codes on the API

Done — see #71.

---

## M3-T12 — `locale` on `User`

Done — see #72.

---

## M3-T13 — Settings › General screen

Done — see #73.

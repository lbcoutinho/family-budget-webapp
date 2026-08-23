# 14 — Settings › General

Status: **approved**, in `approved/14-settings-general.html`. Ticket M3-T13, issue #73.

CSV model management extension: **approved** in `approved/14-settings-general-models.html`, issue #228.

## What's settled going in (from the ticket)

- New nav item **Geral**, inside the Configurações submenu, above Contas and Categorias.
- Route `/settings/general`.
- One section, **Idioma** — a `Select` of Português (Brasil) / English (US), saved immediately, no
  Save button.
- Changing language switches the interface without reload; the choice survives logout/login; a
  failed save reverts the control and explains why.

## Numbering deviation

The issue names the file `prototypes/07-settings-general.html`. 07 is already taken —
`07-transaction-form.html`, the entry-form dialog (`plans/screens/07-entry-form.md`). Drawn as
`14-settings-general.html` instead, the next free number after the original thirteen-screen
inventory. Flagged as a comment on issue #73 rather than silently reusing 07.

## Drawn this pass

- The select autosaves; three states shown side by side — saving (disabled control + pulsing
  "Salvando…" label), confirmed (toast), and failed (control reverts, red one-line explanation below
  it, no modal).
- No card footer, no dialog — it's one field, not a form. Matches the ticket's "no Save button."

## Approved, with revision

All three points below were approved in full. The review also asked for a layout pass, applied
before moving to `approved/`:

1. Autosave-on-select, no explicit Save button.
2. Inline revert-and-explain on failure, no modal.
3. "Geral" positioned above Contas/Categorias in the submenu (anticipates theme/date-format landing
   as future sections of this same screen, not new menu items).

**Layout revision (2026-08-08):** label shortened from "Idioma da interface" to "Idioma"; the note
and the error message now span from the start of the label to the end of the field (`.field-row`
became a two-column grid with the note/error on a full-width row beneath), instead of being trapped
under the label's column only; label column widened; `.select` narrowed to 160px, sized to the text
it holds rather than a flat 220px minimum.

## CSV model management — approved

Variant A was approved: a compact continuous section below Language, with an outline “Novo modelo”
action aligned to the list's upper-right corner. Rows use compact spacing. The empty state is one
line — “Nenhum modelo CSV registrado” — beside the same create action. Creation captures exact
header names without an example file; validation is inline. Deletion names the model and does not
affect imported drafts. Variants B and C were discarded.

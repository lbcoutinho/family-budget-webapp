# 14 — Settings › General

Status: v2, drawn, under review. Ticket M3-T13, issue #73.

## What's settled going in (from the ticket)

- New nav item **Geral**, inside the Configurações submenu, above Contas and Categorias.
- Route `/settings/general`.
- One section, **Idioma** — a `Select` of Português (Brasil) / English (US), saved immediately, no
  Save button.
- Changing language switches the interface without reload; the choice survives logout/login; a
  failed save reverts the control and explains why.

## Numbering deviation

The issue names the file `prototypes/07-settings-general.html`. 07 is already taken —
`07-transaction-form.html`, the entry-form dialog (`plans/0002-screens.md` §4). Drawn as
`14-settings-general.html` instead, the next free number after the original thirteen-screen
inventory. Flagged as a comment on issue #73 rather than silently reusing 07.

## Drawn this pass

- The select autosaves; three states shown side by side — saving (disabled control + pulsing
  "Salvando…" label), confirmed (toast), and failed (control reverts, red one-line explanation below
  it, no modal).
- No card footer, no dialog — it's one field, not a form. Matches the ticket's "no Save button."

## Open for review

See the prototype's own "Decisões a aprovar" block:

1. Autosave-on-select vs. an explicit Save button.
2. Inline revert-and-explain on failure vs. a modal/toast-only error.
3. "Geral" positioned above Contas/Categorias in the submenu (anticipates theme/date-format landing
   as future sections of this same screen, not new menu items).

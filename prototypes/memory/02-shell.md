# 02 — Shell

Status: **approved**, in `approved/`. M3-T06 unblocked on the UI side.

**The registries become sub-items of a "Configurações" menu**, instead of a flat group under a
"Cadastros" label: Contas and Categorias.

**Caixinhas is the second top-level item, directly below Mês** — decided in the v2 review, moved
out of Configurações. Same reason as Recorrências: it is visited while running the month, not set
up once and forgotten.

**Recorrências stays at the top level**, alongside Mês, Caixinhas, Relatórios and Lançar por voz.

**No burger on the desktop.** The sidebar is fixed above 900 px, so the menu button has nothing to
open and does not render. (In the v2 drawing it did — `.btn`'s `display` was overriding `.burger`'s;
the rule now sits after the button rules in `proto.css`.)

## Review of the v2 drawing — settled 2026-08-02, all five approved

1. **On the phone the main action stays in the top bar — no floating action button.** The
   alternative was drawn beside it and rejected, against the plan's own §3.4, which proposed one.
   The sticky top bar already keeps the action visible and the floating button covers the last row
   of the month list.
2. **The sidebar does not collapse on the desktop.** 244 px fixed, no icons-only mode, no collapse
   control.
3. **Logout asks for no confirmation.**
4. **The brand is the palette — four squares — and the name is "Orçamento".**
5. **The user and the logout sit at the foot of the sidebar**, not in the top bar.

## Icons

Two icons were wrong in the v2 drawing and are replaced in `_shared/proto.js`, so every screen
inherits them:

- **Configurações is a gear.** The circle-with-rays read as a sun, and the gear is the convention.
- **Recorrências is two arrows turning, one behind the other** — the cycle. The previous pair of
  straight arrows read as a transfer.

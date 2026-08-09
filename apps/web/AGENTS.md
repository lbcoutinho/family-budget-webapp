## UI prototypes (blocking rule for every screen)

- **No screen is written in React without an approved prototype.** Prototypes live in `prototypes/` — throwaway HTML, one shared `_shared/proto.css` +
  `proto.js`, no build step, no dependencies. Purpose: settle concept, colour, typography, spacing and animation while changing one's mind is still free.
- **Before implementing any screen ticket, check `prototypes/approved/`.** Prototype missing or still under review → **stop and ask**, don't improvise UI.
- **UI strings go through i18n keys** (`apps/web/src/i18n/`, ADR-0018): pt-BR is the default locale and the source of truth for wording, en-US is kept at
  parity, `eslint-plugin-i18next` enforces it. Filenames, comments, commits stay en-US. Sample data fictional but consistent across screens (same
  accounts/categories, July 2026).
- An approved prototype may be edited when implementation reveals a problem — say so in the PR. What must never happen is a built screen silently diverging from
  it.

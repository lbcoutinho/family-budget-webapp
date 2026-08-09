# 04 — Categories (`/categories`)

**Ticket:** M3-T08

| Action | Result |
| --- | --- |
| Switch expense / income tab | Filters by `kind` |
| Expand a category | Reveals its subcategories |
| Create root category | Automatically ships with an "Outros" subcategory |
| Create subcategory from its parent | `parentId` pre-filled; the parent shows as a label with its colour swatch, not an editable field |
| Pick colour | Ten suggested swatches plus a hex field |
| Deactivate parent | Confirmation stating that the children go with it |
| Deactivate last active subcategory | Blocked, 409 explained inline |
| Search | Filters the tree |

Colour belongs to the root category; subcategories inherit it in charts. There is no "gasto no
mês" column: it was dropped at review, which leaves this screen with no dependency on M6 data.

**Design-approved 2026-08-04.** The row count column stays, shown as a number. On desktop
"+ Subcategoria" is a visible dashed button beside the count, in the parent row's middle column.
**On mobile that column disappears and the action must move inside the expanded parent row** —
the prototype does not draw this state, so it is called out here rather than left implicit: an
implementation that only ports the desktop button loses the ability to add a subcategory on
mobile entirely.

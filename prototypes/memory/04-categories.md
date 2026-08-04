# 04 — Categories

Status: **approved**, in `approved/`, approved 2026-08-04. M3-T08 unblocked on the UI side.

**Design-approved on 2026-08-04.** All five "Decisões a aprovar" on the page were approved, plus
one change made during the review itself:

- **The mobile gap is real and stays undrawn on purpose — but the ticket now says so explicitly.**
  On the phone, expanding a category hides the "+ Subcategoria" button along with the count column
  it sits in, and the prototype doesn't draw a replacement. Not worth reworking the mock-up for;
  instead `plans/milestones/m03-master-data.md` (M3-T08) now states directly that the action must
  move inside the expanded parent row on narrow viewports, so it isn't quietly lost when the
  desktop layout gets implemented first.
- **The count column and its number stay**, both approved as drawn.
- **New, decided in this review rather than drawn originally: the subcategory dialog's "Categoria"
  field is a label with the colour swatch beside it, not an input.** The field was disabled but
  still looked like a form field, which invited the question of why it couldn't be typed into. A
  label with the parent's swatch states the same fact — which category this will belong to —
  without implying it's editable. Applied directly to the prototype before moving it to `approved/`.
- **No "gasto no mês" / "recebido no mês" column.** This also removes the screen's only dependency
  on report data, so M3-T08 no longer needs anything from M6.
- **Subcategory creation has to be visible.** The user's note is that the prototype does not show
  how subcategories are created. The action does exist — a "+ Subcategoria" button on the parent
  row — but it sits inside `.row-actions`, which is `opacity: 0` until the row is hovered. So it is
  invisible on first look, in a screenshot, and on touch. Surface it properly rather than adding a
  second path.
- Remaining approved as prototyped: the tree as an expandable table rather than a nested list;
  colour belongs to the root category and subcategories inherit it in charts; the automatic
  "Outros" is marked as such and cannot be the last one deactivated.

## Earlier decision

- **"+ Subcategoria" is a dashed text button in the middle column**, and it disappears on the
  phone, where the action moves inside the expanded parent row (see the mobile-gap note above).
- **The "Outros" subcategory's deactivate button is disabled rather than absent** when it is the
  last active one, so the reason can be shown on click. The backend still answers 409.

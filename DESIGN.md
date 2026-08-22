---
name: Family Budget
description: An achromatic instrument panel where colour belongs to the data — and to the action.
colors:
  bg: '#fcfcfd'
  surface: '#ffffff'
  wash: '#f5f6f8'
  ink: '#14161a'
  ink-soft: '#666d78'
  ink-faint: '#99a0aa'
  line: '#e6e8ec'
  line-strong: '#d5d9df'
  action: '#1a7a52'
  action-hover: '#145f3f'
  action-wash: '#e7f2ec'
  income: '#1a7a52'
  expense: '#bc2f3e'
  transfer: '#3a6ea5'
  cashbox: '#8a6008'
  income-wash: '#e7f2ec'
  expense-wash: '#fbeaec'
  transfer-wash: '#e8eff7'
  cashbox-wash: '#f7f0dd'
  c1: '#1f6f54'
  c2: '#1f5aa8'
  c3: '#a85c1a'
  c4: '#a32c3d'
  c5: '#7a45b5'
  c6: '#0f7c82'
  c7: '#b5407e'
  c8: '#4c6019'
  c9: '#6f3d24'
  c10: '#4a5568'
typography:
  display:
    fontFamily: 'Familjen Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(1.5rem, 3.4vw, 1.95rem)'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Familjen Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.05rem'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Familjen Grotesk, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9rem'
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: 'Public Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Public Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '11.5px'
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: '0.04em'
  numeric:
    fontFamily: 'Public Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: 'tabular-nums'
rounded:
  xs: '4px'
  sm: '6px'
  md: '10px'
  lg: '14px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '22px'
components:
  button-primary:
    backgroundColor: '{colors.action}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '0 16px'
    height: '36px'
  button-primary-hover:
    backgroundColor: 'color-mix(in srgb, {colors.action} 90%, transparent)'
    textColor: '#ffffff'
  button-outline:
    backgroundColor: '{colors.bg}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '0 16px'
    height: '36px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.sm}'
    padding: '7px 13px'
  button-danger:
    backgroundColor: '{colors.expense}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '0 16px'
    height: '36px'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '36px'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.lg}'
    padding: '24px 0'
  badge:
    backgroundColor: '{colors.wash}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.xs}'
    padding: '2px 7px'
  nav-item-active:
    backgroundColor: '{colors.action}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '7px 10px'
---

# Design System: Family Budget

## Overview

**Creative North Star: "The Instrument Panel"**

This is a reading instrument for a household's money, not a brand experience. Its governing decision — the thesis of the "Cromático" direction chosen from four candidates, amended once in review — is that **colour belongs to the data, and to the action**. There is still no brand accent. The frame around the data is built from ink (`#14161a`) and hairline greys, so almost every saturated colour on screen comes from what the data means: the four money colours and the ten category swatches. The single exception is `--action`, and it is not a new hue: it is the income green, reused as a _surface_ for the one thing the user is meant to do next. Remove the data and the only colour left on the page is the button.

The result reads as precise and restrained. Density is high — this is a screen someone scans a bank statement against — so every figure is set with `font-variant-numeric: tabular-nums` so it aligns down its column, and structure is drawn with 1px lines and pale washes rather than boxes and shadows. Nothing is rounded enough to feel soft; nothing is shadowed enough to float unless it genuinely sits above the page (a dialog, a toast). The personality is in the discipline: an instrument you trust because it never decorates the readings.

The system commits to **one appearance — light only.** Dark mode is not deferred, it is rejected, and that single commitment is what makes the light palette worth tuning to the contrast floor. Both desktop and phone are first-class: a wide table is not a desktop feature with a mobile fallback; both layouts are the design.

**Key Characteristics:**

- No brand colour. The chrome is ink and hairline grey; hue means data — except one green action surface.
- Four fixed money colours + ten category swatches, each a single value (no light/dark pair).
- Tabular figures everywhere a number appears, in the body face — no third typeface.
- Near-flat: depth from lines and washes; shadows reserved for what truly lifts.
- Light-only, tuned so every category swatch clears 4.8:1 on the page.
- Two families, three roles: Familjen Grotesk for display, Public Sans for everything else including numbers.

## Colors

An achromatic frame carrying two closed sets of meaningful colour — the money four and the category ten — plus one action surface borrowed from the money set.

### Primary

- **Ink** (`#14161a`): The chrome's structural "colour". Table headers, avatars, tooltips, toasts, the toggle switch when on, page and section titles. Where a lesser system would put a brand accent, this puts ink.
- **Action Green** (`#1a7a52`): The one thing the user is meant to do next — primary button fill, focus ring, active nav item. Deliberately the same value as Income Green; see The Two Grammars Rule.
- **Action Hover** (`#145f3f`): The single darker step, used only for the primary button's hover.

### Secondary — Money (fixed forever)

The semantic four. Independent of everything else so a colour never changes what a table means. All four clear 4.5:1 on white.

- **Income Green** (`#1a7a52`): Money in — INCOME rows, positive figures, income badges.
- **Expense Red** (`#bc2f3e`): Money out — EXPENSE rows, negative balances, destructive buttons, error states, field errors.
- **Transfer Blue** (`#3a6ea5`): TRANSFER between accounts.
- **Cashbox Amber** (`#8a6008`): Cashbox operations. Darkened from an earlier `#a0700f` (4.4:1) to reach 5.6:1 — the one money colour that had to move for contrast.

Each has a pale **wash** (`income-wash`, `expense-wash`, `transfer-wash`, `cashbox-wash`) used as badge and callout backgrounds behind the matching full-strength text.

### Tertiary — Category swatches

Ten values (`c1`–`c10`), permanent identity assigned to a root category and inherited by its subcategories in charts. Cut from sixteen because six of those were near-duplicates and eleven or twelve categories is the real ceiling; the survivors were then re-tuned so each is ≥ 4.8:1 on the page (usable as text, not only as a dot) and no pair is closer than ΔE2000 12.9 in normal vision. `c10` (grey) is permanently "Outros". Past ten, categories repeat a colour — **expected and accepted**, because the value does the identifying.

### Neutral

- **Background** (`#fcfcfd`): The page. A hair off white so surfaces read as raised.
- **Surface** (`#ffffff`): Cards, inputs, sidebar, table cells at rest.
- **Wash** (`#f5f6f8`): Row hover, table footers, segmented-control track, skeletons, subtle fills.
- **Ink Soft** (`#666d78`): Secondary text, muted labels, inactive nav.
- **Ink Faint** (`#99a0aa`): Placeholders, disabled text, tertiary hints.
- **Line** (`#e6e8ec`) / **Line Strong** (`#d5d9df`): Hairline dividers and, at the strong step, input borders and the rule above table footers.

### Named Rules

**The No-Brand Rule.** No colour is decorative and no colour is the brand. If a hue is on screen it is because the data underneath it has that meaning, or because it is the action. The rest of the chrome is ink and grey, always.

**The Two Grammars Rule.** Action and income are the same green and must never be confused, so they are told apart by grammar rather than by hue: **action is a filled surface, money is text.** A green fill means "act here"; green text means "money in". No data may claim a green surface, and no action may be green text.

**The Value Names Rule.** Colour groups; the number names. Ten hues cannot all be told apart in a donut, least of all by a colour-blind reader, so a chart always labels the slice with its own amount. Never require the reader to match a swatch to a legend, and never group categories into "Outras".

**The Money-Is-Fixed Rule.** The four money colours are semantic constants. They do not shift with any future theme decision, because a green that stops meaning "in" breaks every table.

## Typography

**Display Font:** Familjen Grotesk (with ui-sans-serif, system-ui fallback)
**Body Font:** Public Sans (with ui-sans-serif, system-ui fallback)
**Mono Font:** none as a webfont; inline `code` falls back to the system monospace stack

Public Sans carries running text _and_ every number.

**Character:** Two families, three jobs. Familjen Grotesk is a tight geometric grotesk that gives headings and headline figures a compact, engineered feel (negative tracking, weight 700). Public Sans is a neutral, legible humanist workhorse for all running text, controls, and every number. Both ship `tnum`, which is what actually makes a money column align — the fixed-width figure, not a change of typeface.

### Hierarchy

- **Display** (700, fluid 1.5–1.95rem, tracking `-0.025em`): Page titles (`h1`) and stat-tile values. The only genuinely large type.
- **Headline** (600, `1.05rem`, tracking `-0.02em`): Section headers (`h2`), the current-month label in the top bar, the sidebar brand.
- **Title** (600, `0.9rem`): Card and subsection headers (`h3`).
- **Body** (400, `14px`, line-height `1.5`): All running text, form values, table cells. Prose caps at ~68ch.
- **Label** (600, `11.5px`, tracking `0.04em`, UPPERCASE): Table column headers and small eyebrow labels. Field labels are the softer 500 / 12.5px variant.
- **Numeric** (400/600, `14px`, `tabular-nums`): Every amount, date, and count, via the `.num` class. Same family as body; only the figures change.

### Named Rules

**The Tabular Number Rule.** Every figure carries `font-variant-numeric: tabular-nums`. Money that does not align down the column cannot be scanned, and scanning is the whole job. Monospace is a strong convention for code, not for money — Material 3, Carbon and the HIG all ask for tabular figures without a separate family, so this system has none.

**The Two Families Rule.** Familjen Grotesk and Public Sans. A third family needs a job neither can do; "numbers look different" is not that job.

**The Number-As-Display Rule.** The largest numbers on screen (stat-tile values) borrow Familjen Grotesk at 700 with tight tracking and tabular figures — a headline figure, not body text scaled up.

## Layout

A fixed two-column shell: a `244px` sidebar (surface, hairline right border) beside a fluid main column. The main column stacks a sticky, blurred top bar over content padded `22px` and capped at `1120px`. The spacing rhythm is a small 4px scale — gaps of `4 / 8 / 12 / 16px`, content inset `22px` — producing a dense grid where information leads and whitespace is earned, not lavish.

Cards, stat tiles, and grids reflow with `auto-fit minmax()` so a stat row collapses gracefully. **Responsive is designed at both ends, not derived.** Below `900px` the sidebar becomes an off-canvas drawer (a burger toggles it, `translateX` transition), the shell drops to one column, and padding tightens to `16px 14px`. The two report matrices that cannot reflow — the yearly grid especially — scroll horizontally inside `.table-wrap` with a **frozen first column** (`position: sticky; left: 0`) instead of collapsing to cards. The month list went the other way: it is rows rather than a table, which cost the sortable column header (sorting moved to a select above the list) and bought one layout that works at both ends.

## Elevation & Depth

Near-flat, hairline-first. Depth is built from 1px lines (`line`, `line-strong`) and pale washes, not from shadows. Surfaces rest flat; a shadow appears only when an element genuinely sits above the page. Three shadow tokens, in ascending lift.

### Shadow Vocabulary

- **Rest** (`box-shadow: 0 1px 2px rgba(20,22,26,0.05)`): The barely-there settle under cards and the segmented control's active thumb. Reads as a printed edge, not a float — deliberately almost invisible, because the separation comes from the border.
- **Raised** (`box-shadow: 0 4px 14px rgba(20,22,26,0.08)`): Tooltips and menus — content overlapping other content within the page.
- **Floating** (`box-shadow: 0 18px 48px rgba(20,22,26,0.16)`): Dialogs, toasts, the mobile sidebar drawer — the only truly overlaid surfaces, always paired with a scrim or off-canvas transform.

### Named Rules

**The Hairline-First Rule.** Reach for a 1px line or a wash before a shadow. A shadow is a claim that the element is above the page; if it is not, it gets a line.

## Shapes

A tight, consistent radius family: `4px` (badges, bars, small chips), `6px` (nav items and segmented controls), `8px` (buttons and inputs), `10px` (dialogs), `14px` (cards and stat tiles). Nothing is pill-shaped except the toggle switch; nothing is sharp-cornered. Borders are the primary structural device — hairline `line` for dividers and input strokes, with `line-strong` reserved for the total rule above table footers. The recurring silhouette is a bordered rectangle with a small radius: quiet, rectilinear, instrument-like. Category identity appears as a small `9px` rounded-square **dot**, never a full-bleed colour block. The product mark is the palette itself: four of the ten swatches as `7px` rounded squares in a 2×2 grid.

## Components

For each: a short character line, then shape, colour, states, distinctive behaviour.

### Buttons

Compact and rectilinear; green for the action, ink never, colour only for danger.

- **Shape:** `36px` high with an `8px` radius, `16px` horizontal padding, and `14px` text at weight 500.
- **Primary:** Action-green fill (`#1a7a52`), white text. Hover uses the same green at 90% opacity. A black primary button was tried first and rejected — it did not read as a call to action.
- **Outline:** Background fill, ink text, `line` border. Hover fills with `wash`.
- **Ghost:** Transparent, `ink-soft` text, no border. Hover fills `wash`, text goes ink.
- **Danger:** Expense-red fill (`#bc2f3e`), white text; hover `#a52836`.
- **Sizes:** `.sm` (`5px 10px`) and `.icon` (30px square). Disabled drops to `0.45` opacity.
- **Focus:** Global `2px` solid action-green outline, `2px` offset.

### Segmented control

The type/mode switcher (transaction type, report tabs). A `wash` track holding buttons; the selected one gets a surface fill, ink text at 600, and the Rest shadow — a thumb that reads as physically pressed forward. It stays achromatic even when the choice it makes is coloured elsewhere: on the launch dialog it opens pre-selected on "Despesa", and the green button beside it means _action_, not _type_.

### Inputs / Fields

Quiet until focused.

- **Style:** Transparent fill, `line` `1px` border, `8px` radius, `36px` height, `12px` horizontal padding; `16px` text on compact screens and `14px` at the shell breakpoint.
- **Focus:** Global action-green focus ring (`2px` solid, `2px` offset).
- **Error:** Border switches to expense-red; a `field-error` line in the same red sits below.
- **Search variant:** Left-inset magnifier in `ink-faint`, `30px` left padding.
- **Toggle switch:** `34×19px` pill; off is `wash` with a `line-strong` border, on is **ink** fill with the thumb slid right — a switch is a setting, not an action, so it does not take the green.

### Cards / Containers

- **Corner:** `14px` radius; dialogs use `10px`.
- **Background:** Surface, `line` border, the Rest shadow only.
- **Structure:** The base card has `24px` vertical padding; its header, body, and footer add `24px` horizontal padding and are separated by hairlines when needed.
- **Stat tile:** A denser card variant with `16px` padding; the `.total` tile swaps to a `wash` fill with a `line-strong` border to mark the summary. Its value is display type with tabular figures.

### Badges & dots

- **Badge:** Tiny (`10.5px`, 600, `0.03em` tracking), `wash` pill by default; money variants use the matching wash background with money-colour text. The **draft** badge is a dashed `line-strong` outline on transparent — a deliberately provisional look for unconfirmed voice entries, which appear in the month list dimmed and count in no total.
- **Dot:** `9px` rounded square carrying a category swatch; the identity marker beside a label, never a large colour field.

### Navigation

Sidebar list, `13.5px` items in `ink-soft`. Hover fills `wash` and darkens to ink. **The active item is a solid action-green fill with white text** (`aria-current="page"`) — the second of the three places the green is allowed. Disabled items go `ink-faint`, no hover. Collapsible groups ("Configurações", which holds the three registries) use a rotating caret; Recorrências stays top-level. On mobile the whole sidebar becomes the off-canvas drawer.

### Tables (signature)

The workhorse of this app.

- Uppercase `label`-style headers over hairline-separated rows; `wash` on row hover. Headers are ink-soft, never coloured.
- **Numbers right-aligned** (`.n`), always tabular.
- Footers sit on a `wash` fill above a `line-strong` rule for totals.
- Child rows (subcategories) get a faint `#fafbfc` fill and a deep left indent.
- **Frozen first column** (`.freeze`) for the report matrices that scroll rather than reflow.

### Tooltip (signature)

An ink bubble (`250px`, white text, Raised shadow) that must open deliberately — it lives inside horizontally-scrolling tables that clip overflow, so its side is chosen by hand (`.up` flips it above). It carries the definitions the headings cannot, e.g. the "Média 12 meses" window and its divisor.

### Motion

One curve, `cubic-bezier(0.2, 0.9, 0.3, 1)`, and two interface durations: **120ms** for hover, focus and toggles; **200ms** for dialogs, the drawer and toasts. `prefers-reduced-motion` collapses everything to 1ms. Two deliberate exceptions, each earned: the month strip takes ~700ms to enter day by day, because there the duration _is_ the content, and it happens once per screen; and a total may count up when a filter changes, because the question changed and there is nothing to reconcile.

## Do's and Don'ts

### Do:

- **Do** keep the chrome ink-and-grey. Table headers, avatars, tooltips, toasts, and the toggle switch are ink (`#14161a`).
- **Do** spend the action green in exactly three places: the primary button, the focus ring, the active nav item.
- **Do** set every amount, date, and count with `tabular-nums` via `.num`, in Public Sans.
- **Do** build structure from `1px` lines and washes first; use a shadow only for a card at rest or something that truly floats.
- **Do** label chart slices with their own amount, and draw every category — colour groups, the number names.
- **Do** keep the four money colours exactly as defined — they are semantic constants, not theme choices.
- **Do** design the phone layout as an equal: drawer sidebar, and frozen-column horizontal scroll for matrices that can't reflow.

### Don't:

- **Don't** introduce a brand accent colour. The green is the action, not the brand, and no fourth use of it is authorized.
- **Don't** give a data value a green _surface_, or an action green _text_ — the grammar is what keeps income and action apart.
- **Don't** add dark mode or a second value for any token. The system is light-only by decision.
- **Don't** add a third typeface. Numbers already have what they need from `tnum`.
- **Don't** wrap surfaces in shadows to create hierarchy where a hairline or wash would do.
- **Don't** let green/red mean "good/bad" anywhere except the one confirmed against-the-average column on the monthly report.
- **Don't** group categories into "Outras", and don't collapse the report matrices to cards on mobile — freeze the first column and scroll.

---
name: Family Budget
description: An achromatic instrument panel where colour belongs only to the data.
colors:
  bg: '#fcfcfd'
  surface: '#ffffff'
  wash: '#f5f6f8'
  ink: '#14161a'
  ink-hover: '#2a2e36'
  ink-soft: '#666d78'
  ink-faint: '#99a0aa'
  line: '#e6e8ec'
  line-strong: '#d5d9df'
  income: '#1a7a52'
  expense: '#bc2f3e'
  transfer: '#3a6ea5'
  cashbox: '#8a6008'
  income-wash: '#e7f2ec'
  expense-wash: '#fbeaec'
  transfer-wash: '#e8eff7'
  cashbox-wash: '#f7f0dd'
  c1: '#1f6f54'
  c2: '#2e6da4'
  c3: '#b4641e'
  c4: '#a32c3d'
  c5: '#6b4ca8'
  c6: '#0f7c82'
  c7: '#b5407e'
  c8: '#4a5568'
  c9: '#7a8b1f'
  c10: '#c2571a'
  c11: '#2b4c9b'
  c12: '#8a2f5f'
  c13: '#157f6e'
  c14: '#94701c'
  c15: '#5d5fa6'
  c16: '#8c4a2f'
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
  mono:
    fontFamily: 'DM Mono, ui-monospace, monospace'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.5
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
    backgroundColor: '{colors.ink}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '7px 13px'
  button-primary-hover:
    backgroundColor: '{colors.ink-hover}'
    textColor: '#ffffff'
  button-outline:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '7px 13px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.sm}'
    padding: '7px 13px'
  button-danger:
    backgroundColor: '{colors.expense}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '7px 13px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '7px 10px'
  card:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.md}'
    padding: '16px'
  badge:
    backgroundColor: '{colors.wash}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.xs}'
    padding: '2px 7px'
  nav-item-active:
    backgroundColor: '{colors.ink}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: '7px 10px'
---

# Design System: Family Budget

## Overview

**Creative North Star: "The Instrument Panel"**

This is a reading instrument for a household's money, not a brand experience. Its governing decision — the thesis of the "Cromático" direction chosen from four candidates — is that **colour belongs to the data and never to the chrome**. There is no brand accent. The frame around the data is built entirely from ink (`#14161a`) and hairline greys, so the only saturated colour on any screen comes from what the data means: the four money colours and the sixteen category swatches. Remove the data and the interface is achromatic on purpose.

The result reads as precise and restrained. Density is high — this is a screen someone scans a bank statement against — so every number is set in a monospaced, tabular face that aligns down the column, and structure is drawn with 1px lines and pale washes rather than boxes and shadows. Nothing is rounded enough to feel soft; nothing is shadowed enough to float unless it genuinely sits above the page (a dialog, a toast). The personality is in the discipline: an instrument you trust because it never decorates the readings.

The system commits to **one appearance — light only.** Dark mode is not deferred, it is rejected, and that single commitment is what makes the light palette worth tuning to the contrast floor. Both desktop and phone are first-class: a wide table is not a desktop feature with a mobile fallback; both layouts are the design.

**Key Characteristics:**

- No brand colour — chrome is ink and hairline grey; hue means data.
- Four fixed money colours + sixteen category swatches, each a single value (no light/dark pair).
- Monospaced tabular numbers everywhere a figure appears.
- Near-flat: depth from lines and washes, shadows reserved for what truly lifts.
- Light-only, tuned to a 4.5:1 contrast floor.
- Familjen Grotesk / Public Sans / DM Mono — three roles, three families.

## Colors

An achromatic frame carrying two closed sets of meaningful colour: the money four and the category sixteen. Every hue on screen is data; the interface itself has none.

### Primary

- **Ink** (`#14161a`): The chrome's only "colour". Primary buttons, the active nav item, focus rings, table headers, avatars, tooltips, toasts. Where a lesser system would put a brand accent, this puts ink — that substitution _is_ the identity.
- **Ink Hover** (`#2a2e36`): The one step lifted from ink, used solely for the primary button's hover.

### Secondary — Money (fixed forever)

The semantic four. Independent of everything else so a colour never changes what a table means. All four clear 4.5:1 on white.

- **Income Green** (`#1a7a52`): Money in — INCOME rows, positive figures, income badges.
- **Expense Red** (`#bc2f3e`): Money out — EXPENSE rows, negative balances, destructive buttons, error states, field errors.
- **Transfer Blue** (`#3a6ea5`): TRANSFER between accounts.
- **Cashbox Amber** (`#8a6008`): Cashbox operations. Darkened from an earlier `#a0700f` (4.4:1) to reach 5.6:1 — the one money colour that had to move for contrast.

Each has a pale **wash** (`income-wash` `#e7f2ec`, `expense-wash` `#fbeaec`, `transfer-wash` `#e8eff7`, `cashbox-wash` `#f7f0dd`) used as badge and callout backgrounds behind the matching ink-strength text.

### Tertiary — Category swatches

Sixteen values (`c1`–`c16`), permanent identity assigned to a root category and inherited by its subcategories in charts. Sixteen rather than eight to halve collision risk when every category is drawn. Grouped by hue but never relied on alone — see the Value Names rule.

### Neutral

- **Background** (`#fcfcfd`): The page. A hair off white so surfaces read as raised.
- **Surface** (`#ffffff`): Cards, inputs, sidebar, table cells at rest.
- **Wash** (`#f5f6f8`): Row hover, table footers, segmented-control track, skeletons, subtle fills.
- **Ink Soft** (`#666d78`): Secondary text, muted labels, inactive nav.
- **Ink Faint** (`#99a0aa`): Placeholders, disabled text, tertiary hints.
- **Line** (`#e6e8ec`) / **Line Strong** (`#d5d9df`): Hairline dividers and, at the strong step, input borders and total rules.

### Named Rules

**The No-Brand Rule.** No colour is decorative and no colour is the brand. If a hue is on screen it is because the data underneath it has that meaning. The chrome is ink and grey, always.

**The Value Names Rule.** Colour groups; the number names. Sixteen hues cannot be told apart in a donut, least of all by a colour-blind reader, so a chart always labels the slice with its own amount. Never require the reader to match a swatch to a legend.

**The Money-Is-Fixed Rule.** The four money colours are semantic constants. They do not shift with any future theme decision, because a green that stops meaning "in" breaks every table.

## Typography

**Display Font:** Familjen Grotesk (with ui-sans-serif, system-ui fallback)
**Body Font:** Public Sans (with ui-sans-serif, system-ui fallback)
**Number/Mono Font:** DM Mono (with ui-monospace, monospace fallback)

**Character:** Three families for three jobs. Familjen Grotesk is a tight geometric grotesk that gives headings and headline numbers a compact, engineered feel (negative tracking, weight 700). Public Sans is a neutral, legible humanist workhorse for all running text and controls. DM Mono carries every figure so amounts, dates, and counts align — the trait that makes a dense ledger scannable.

### Hierarchy

- **Display** (700, `clamp(1.5rem, 3.4vw, 1.95rem)`, tracking `-0.025em`): Page titles (`h1`) and stat-tile values. The only genuinely large type.
- **Headline** (600, `1.05rem`, tracking `-0.02em`): Section headers (`h2`), the current-month label in the top bar, the sidebar brand.
- **Title** (600, `0.9rem`): Card and subsection headers (`h3`).
- **Body** (400, `14px`, line-height `1.5`): All running text, form values, table cells.
- **Label** (600, `11.5px`, tracking `0.04em`, UPPERCASE): Table column headers and small eyebrow labels. Field labels are the softer 500 / 12.5px variant.
- **Mono** (400/500, `14px`, `tabular-nums`): Every amount, date, and count via the `.num` class. Inline `code` uses it too.

### Named Rules

**The Tabular Number Rule.** Every figure is DM Mono with `font-variant-numeric: tabular-nums`. Money that does not align down the column cannot be scanned, and scanning is the whole job. Never set an amount in the body face.

**The Number-As-Display Rule.** The largest numbers on screen (stat-tile values) borrow Familjen Grotesk at 700 with tight tracking — a headline figure, not body text scaled up.

## Layout

A fixed two-column shell: a `244px` sidebar (surface, hairline right border) beside a fluid main column. The main column stacks a sticky, blurred top bar over content padded `22px` and capped at `1120px`. The spacing rhythm is small and consistent — gaps of `4 / 8 / 12 / 16px`, content inset `22px` — producing a dense grid where information leads and whitespace is earned, not lavish.

Cards, stat tiles, and grids reflow with `auto-fit minmax()` so a stat row collapses gracefully. **Responsive is designed at both ends, not derived.** Below `900px` the sidebar becomes an off-canvas drawer (a burger toggles it, `translateX` transition), the shell drops to one column, and padding tightens to `16px 14px`. The two report matrices that cannot reflow — the yearly grid especially — scroll horizontally inside `.table-wrap` with a **frozen first column** (`position: sticky; left: 0`) instead of collapsing to cards.

## Elevation & Depth

Near-flat, hairline-first. Depth is built from 1px lines (`line`, `line-strong`) and pale washes, not from shadows. Surfaces rest flat; a shadow appears only when an element genuinely sits above the page. Three shadow tokens, in ascending lift:

### Shadow Vocabulary

- **Rest** (`box-shadow: 0 1px 2px rgba(20,22,26,0.05)`): The barely-there settle under cards and the segmented control's active thumb. Reads as a printed edge, not a float.
- **Raised** (`box-shadow: 0 4px 14px rgba(20,22,26,0.08)`): Tooltips — content overlapping other content within the page.
- **Floating** (`box-shadow: 0 18px 48px rgba(20,22,26,0.16)`): Dialogs, toasts, the mobile sidebar drawer — the only truly overlaid surfaces, always paired with a scrim or off-canvas transform.

### Named Rules

**The Hairline-First Rule.** Reach for a 1px line or a wash before a shadow. A shadow is a claim that the element is above the page; if it is not, it gets a line.

## Shapes

A tight, consistent radius family: `4px` (badges, bars, small chips), `6px` (buttons, inputs, nav items, segmented controls — the default), `10px` (cards, stat tiles), `14px` (dialogs). Nothing is pill-shaped except the toggle switch; nothing is sharp-cornered. Borders are the primary structural device — hairline `line` for dividers, `line-strong` for input strokes and the total rule above table footers. The recurring silhouette is a bordered rectangle with a small radius: quiet, rectilinear, instrument-like. Category identity appears as a small `9px` rounded-square **dot**, never a full-bleed colour block.

## Components

For each: a short character line, then shape, colour, states, distinctive behaviour.

### Buttons

Compact and rectilinear; ink by default, colour only for danger.

- **Shape:** Small radius (`6px`), `1px` border, `7px 13px` padding.
- **Primary:** Ink fill (`#14161a`), white text, ink border. Hover lifts fill to `#2a2e36`.
- **Outline:** Surface fill, ink text, `line-strong` border. Hover fills with `wash`.
- **Ghost:** Transparent, `ink-soft` text, no border. Hover fills `wash`, text goes ink.
- **Danger:** Expense-red fill (`#bc2f3e`), white text; hover `#a52836`.
- **Sizes:** `.sm` (`5px 10px`) and `.icon` (30px square). Disabled drops to `0.45` opacity.
- **Focus:** Global `2px` solid ink outline, `2px` offset.

### Segmented control

The type/mode switcher (transaction type, report tabs). A `wash` track holding buttons; the selected one gets a surface fill, ink text at 600, and the rest shadow — a thumb that reads as physically pressed forward.

### Inputs / Fields

Quiet until focused.

- **Style:** Surface fill, `line-strong` `1px` border, `6px` radius, `7px 10px` padding, `13.5px` text.
- **Focus:** Global ink focus ring (`2px` solid, `2px` offset).
- **Error:** Border switches to expense-red; a `field-error` line in the same red sits below.
- **Search variant:** Left-inset magnifier in `ink-faint`, `30px` left padding.
- **Toggle switch:** `34×19px` pill; off is `wash` with a `line-strong` border, on is ink fill with the thumb slid right.

### Cards / Containers

- **Corner:** `10px` radius.
- **Background:** Surface, `line` border, the Rest shadow only.
- **Structure:** Optional `card-head` / `card-body` / `card-foot`, each `12–16px` padded and separated by hairlines.
- **Stat tile:** A denser card variant; the `.total` tile swaps to a `wash` fill with a `line-strong` border to mark the summary.

### Badges & dots

- **Badge:** Tiny (`10.5px`, 600, `0.03em` tracking), `wash` pill by default; money variants use the matching wash background with money-colour text. The **draft** badge is a dashed `line-strong` outline on transparent — a deliberately provisional look for unconfirmed voice entries.
- **Dot:** `9px` rounded square carrying a category swatch; the identity marker beside a label, never a large colour field.

### Navigation

Sidebar list, `13.5px` items in `ink-soft`. Hover fills `wash` and darkens to ink. **The active item is a solid ink fill with white text** (`aria-current="page"`) — the clearest place the No-Brand rule shows, since a branded app would tint it. Disabled items go `ink-faint`, no hover. Collapsible groups ("Configurações") use a rotating caret. On mobile the whole sidebar becomes the off-canvas drawer.

### Tables (signature)

The workhorse of this app.

- Uppercase `label`-style headers over hairline-separated rows; `wash` on row hover.
- **Numbers right-aligned** (`.n`), always mono/tabular.
- Footers sit on a `wash` fill above a `line-strong` rule for totals.
- Child rows (subcategories) get a faint `#fafbfc` fill and deep left indent.
- **Frozen first column** (`.freeze`) for the report matrices that scroll rather than reflow.

### Tooltip (signature)

An ink bubble (`250px`, white text, Raised shadow) that must open deliberately — it lives inside horizontally-scrolling tables that clip overflow, so its side is chosen by hand (`.up` flips it above). It carries the definitions the headings cannot, e.g. the "Média 12 meses" window and divisor.

## Do's and Don'ts

### Do:

- **Do** keep all chrome ink-and-grey. Buttons, active nav, focus rings, headers, avatars, tooltips, toasts are ink (`#14161a`).
- **Do** set every amount, date, and count in DM Mono with `tabular-nums` (`.num`).
- **Do** build structure from `1px` lines and washes first; use a shadow only for a card at rest or something that truly floats.
- **Do** label chart slices with their own amount, so meaning never depends on matching a swatch to a legend.
- **Do** keep the four money colours exactly as defined — they are semantic constants, not theme choices.
- **Do** design the phone layout as an equal: drawer sidebar, and frozen-column horizontal scroll for matrices that can't reflow.

### Don't:

- **Don't** introduce a brand accent colour anywhere in the chrome. The absence is the identity.
- **Don't** add dark mode or a second value for any token. The system is light-only by decision.
- **Don't** set an amount in the body face, or let a number column go non-tabular.
- **Don't** wrap surfaces in shadows to create hierarchy where a hairline or wash would do.
- **Don't** repurpose a money colour for decoration, or let green/red mean "good/bad" anywhere except the one confirmed against-the-average column.
- **Don't** collapse the report matrices to cards on mobile — freeze the first column and scroll.

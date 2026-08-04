# 06 — Month

Status: **approved**, in `approved/`, design-approved on 2026-08-02. M5-T01, M5-T05 and M5-T06
unblocked on the UI side.

All six decisions approved as prototyped. Two are worth restating because they were phrased as
questions or affect other screens:

- **Voice drafts do appear in the month list, dimmed, and do not count in the totals** — this was
  the open question on the page, and the prototyped behaviour is the answer.
- **No dashboard**: the balance panel lives at the top of this screen, `/` redirects here.

Also approved: three footer lines rather than a strip of cards; explicit `+`/`−` alongside colour;
credit-card icon with the original purchase date as a sub-line; infinite scroll rather than
numbered pages.

## Second review, on the v2 drawing — settled 2026-08-01

The six "Decisões a aprovar" on the page were **all approved as drawn**. What the review changed is
everything around them, and all of it is applied:

- **The sidebar is approved as a whole** — see [02-shell.md](02-shell.md) for the icon fixes that
  came out of this review.
- **Clicking the month name opens a picker**: a year stepper plus a twelve-month grid, so any month
  of any year is two clicks. The arrows stay for stepping one month at a time; "Hoje" stays.
- **The cashbox button gets the cashbox amber and says what it does.** It was a white outline
  button labelled just "Caixinha", which named a noun rather than an action and read as neutral
  chrome. It is now **"Movimentar caixinha"** with the piggy icon, in the amber that already means
  cashbox everywhere — outlined rather than filled, so it never competes with the green primary.
  It opens the screen-08 dialog, which is deposit, withdraw and transfer in one, so "movimentar"
  is the accurate verb rather than only "adicionar".
- **The strip is titled "Despesas dia a dia"**, replacing "O que saiu, dia a dia". The chart itself
  is liked and stays.
- **"Total consolidado" now sits on an ink background**, white text, instead of the grey wash that
  only barely told it apart from the four account cards. It stays uncoloured: a balance is not an
  action, and the green belongs to the action.
- Filters, sorting, the "31 lançamentos · 1 rascunho" summary and the entry rows are approved as
  drawn — the summary explicitly, because it surfaces pending drafts.

**The strip is stacked — settled after seeing `06-month-chart.html`.** A day can carry more than one
colour: one segment per category, largest at the base, so nothing that left on that day disappears.
It replaces the single dominant-category bar, which hid everything but the largest on 15 of July's
24 spending days. The comparison page stays as the record, with the width slider that showed the
real cost — at phone width a small expense becomes a 1–2 px sliver. The fallback if that sliver
becomes a complaint is written down there and still undrawn: stack at most three segments and roll
the rest into a grey fourth.

**The list stays A — the wide row.** Chosen from the four in `06-month-list.html` (A wide row, B
grouped by day, C dense statement, D collapsed by category), against the page's own recommendation
of B. The comparison page stays as the record of what was rejected.

**Every entry now carries the running balance of its account**, under the amount: grey, 11 px, no
colour — the same shape the monthly report uses to put the average under the percentage. What that
settled:

- **Which account.** The origin — the account the money left. Transfers and cashbox moves have two
  sides and both are applied to the running total, otherwise the destination's later rows would lie;
  only the origin's balance is displayed. The account is named in the row's own sub-line already, so
  the balance shows bare, with the account in a tooltip.
- **Always chronological**, whatever the list is sorted by. Sorting by amount must not change a
  balance.
- **Drafts carry none.** They affect nothing, so there is nothing to show.
- **No `+` on a positive balance**; a negative one keeps its `−`, because there it is information.
- The prototype's June 30 opening balances are picked backwards so the month closes exactly on the
  five balance cards at the top (Millennium 3.482,15 · Revolut 412,90 · Dinheiro −35,00 · caixinhas
  4.150,00 · total 8.010,05). Verified, not assumed.

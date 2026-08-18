# 12 — Recurrences

Status: approved, in full — keep the `autoConfirm` checkbox.

All five approved, including the one that was still a question: **the `autoConfirm` checkbox
stays** — generated entries are not always confirmed, the rule decides.

Also approved: fixed rules and installment plans in one table told apart by the progress column;
two separate creation buttons rather than one form with a type switch; a mandatory preview before
saving; cancelling an installment plan removing only future unconfirmed installments.

## Design review (v2 drawing, under review)

`12-recurrences.html` drawn 2026-08-19 for M7-T06 and sitting in `prototypes/` — **concept was
already approved in full; this is the design gate only.** Seven decisions are on its "Decisões a
aprovar" block:

1. Preview is the right-hand half of the form, not a "Pré-visualizar" step — collapses below the
   form under 900 px and becomes a step again there, accepted.
2. Table shows a "Próxima" column, not an agenda of the next three months (a worse second month
   screen; the yearly report already carries the aggregate).
3. Four stats on top; "Parcelas em aberto" counts installments **not yet generated** — the only
   number on the screen with no rows behind it.
4. Two destructive actions with different names — "Desativar" for an endless rule, "Cancelar
   parcelas futuras" for an installment plan, because the second deletes existing rows.
5. Division remainder goes on the last installment, highlighted in the cashbox amber.
6. Day 31 clamps to the last day of the month, and the preview paints the adjusted date.
7. **Pendency on an already-approved screen:** `approved/06-month.html` draws the `repeat` marker
   only on "Seguro do carro (parcela 4 de 12)", but "Renda de julho" and "Salário" also come from
   fixed rules on this screen. Proposal is a two-line fix to 06 in the same PR, declared rather
   than silent.

The prototype computes both domain rules for real, in integer cents, rather than showing typed
numbers: 100,00 € in 3 gives 33,33 / 33,33 / 33,34, and day 31 gives 28 in February 2026.

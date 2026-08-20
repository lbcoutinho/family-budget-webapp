# 12 — Recurrences

Status: **approved, design included.** `approved/12-recurrences.html` — both gates closed, M7-T06 unblocked on the UI side.

All five concept decisions approved, including the one that was still a question: **the `autoConfirm` checkbox
stays** — generated entries are not always confirmed, the rule decides.

Also approved: fixed rules and installment plans in one table told apart by the progress column;
two separate creation buttons rather than one form with a type switch; a mandatory preview before
saving; cancelling an installment plan removing only future unconfirmed installments.

## Design review (v2 drawing, closed 2026-08-20)

`12-recurrences.html` drawn 2026-08-19 for M7-T06. Seven decisions were on its original "Decisões
a aprovar" block, all approved in the final round:

1. Preview is the right-hand half of the form, not a "Pré-visualizar" step — collapses below the
   form under 900 px and becomes a step again there, accepted.
2. Table shows a "Próxima" column, not an agenda of the next three months (a worse second month
   screen; the yearly report already carries the aggregate).
3. Four stats on top; "Parcelas em aberto" counts installments **not yet generated** — the only
   number on the screen with no rows behind it. It sums only recurrences that have an end
   (installment plans); endless fixed rules never enter this sum.
4. Two destructive actions with different names — "Desativar" for an endless rule, "Cancelar
   parcelas futuras" for an installment plan, because the second deletes existing rows.
5. Division remainder goes on the last installment, highlighted in the cashbox amber.
6. Day 31 clamps to the last day of the month, and the preview paints the adjusted date.
7. **Pendency on an already-approved screen:** `approved/06-month.html` draws the `repeat` marker
   only on "Seguro do carro (parcela 4 de 12)", but "Renda de julho" and "Salário" also come from
   fixed rules on this screen. Proposal is a two-line fix to 06 in the same PR, declared rather
   than silent — still open, to be done at implementation time.

The prototype computes both domain rules for real, in integer cents, rather than showing typed
numbers: 100,00 € in 3 gives 33,33 / 33,33 / 33,34, and day 31 gives 28 in February 2026.

## No daily job — generation is login-triggered

**Standing decision, cross-cutting beyond this screen:** there is no `@Cron` job materializing
recurrences on a schedule. Generation runs on demand — the frontend calls an endpoint right after
login, the backend checks the current date against pending rules and materializes what's due, and
a toast reports how many entries were created. `RecurrenceGeneratorService` (M7-T02) is already a
plain callable, not wired to any scheduler, so no removal was needed. **Ticket #199 (M7-T05 —
"Generation job with a rolling horizon") still describes the old cron design** (`@nestjs/schedule`,
advisory lock, `RECURRENCE_JOB_ENABLED`) and needs its plan rewritten before implementation —
flagged to the user, deferred at their request.

## Two review rounds after the first draw

**Round 1 (2026-08-20):** callout colors standardized (`.callout.info` blue via `--transfer`,
`.callout.success` green via `--income`, added to `_shared/proto.css` — "Desativar" and "Gerar
agora" use them; "Cancelar"/"Apagar" keep warn/error). Top stat cards reworded to "recorrente"
instead of "fixa". Table category separator fixed from `›` to `·` (the app's real convention —
`month-page.tsx` uses `·`). "Gera rascunho"/"inativa" badges moved next to the rule name instead of
the subtitle. "Nova regra fixa" gained a Despesa/Receita segmented toggle (matching prototype 07)
instead of a select, a Categoria/Subcategoria split (was one combined select), and reordered fields.
"Novo parcelamento" got the same categoria split and a field reorder.

**Round 2 (2026-08-20, same day):** simplified the top cards back to two lines each (label + value/
date), removing the extra sub-line added in round 1. "Nova regra fixa": Início/Fim now comes before
the "Confirmar automaticamente" switch; the Valor hint was dropped; the switch's description moved
into a tooltip (matching the Fim field's `.tip` pattern). "Novo parcelamento": all three remaining
hints (Data da compra, Primeira cobrança, Descrição) converted to tooltips. This closed the design
gate — moved to `approved/`.

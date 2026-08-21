/**
 * Frontend mirror of `apps/api/.../recurrence/installment-split.ts` (M7-T04, ADR-0014) — the
 * installment dialog computes its own preview locally (there is no payload-preview endpoint for an
 * unsaved plan), so the split shown while typing must match what the server will actually create.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (count < 1 || totalCents < count) {
    return [];
  }

  const base = Math.floor(totalCents / count);
  const split = new Array<number>(count).fill(base);

  split[count - 1] = totalCents - base * (count - 1);

  return split;
}

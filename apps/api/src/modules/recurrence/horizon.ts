/** The rolling generation horizon (ADR-0014): recurrence generates three months ahead, no further. */
export const ROLLING_HORIZON_MONTHS = 3;

/**
 * Last day of the month that is `months` months from today, UTC. Shared by the per-rule
 * `POST /:id/generate` (M7-T03) and the login-triggered catch-up (M7-T05) so the two paths cannot
 * drift onto different horizons.
 */
export function rollingHorizon(months: number): Date {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months + 1, 0));
}

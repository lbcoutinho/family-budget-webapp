const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `ValidationPipe` runs `class-transformer` before `class-validator`, so a `@Matches` decorator
 * would see the already-converted `Date`, not the original string — the format check has to
 * happen inside the transform itself. A string that fails it passes through unconverted, so the
 * `@IsDate` next to it is what actually rejects it.
 *
 * The explicit `Z` matters: `date`/`referenceMonth` columns are `@db.Date`, and parsing without it
 * would shift the day on a negative-offset host.
 */
export const toDateOnly = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000Z`) : value;

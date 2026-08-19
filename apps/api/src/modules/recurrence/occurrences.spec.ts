import { computeOccurrences, referenceMonthFor, type RecurrenceRuleLike } from './occurrences';

const base: RecurrenceRuleLike = {
  frequency: 'MONTHLY',
  interval: 1,
  dayOfMonth: 10,
  startDate: new Date('2026-01-10'),
  endDate: null,
  totalOccurrences: null,
  generatedUntil: null,
  isActive: true,
};

const iso = (dates: Date[]): string[] => dates.map((d) => d.toISOString().slice(0, 10));

describe('computeOccurrences', () => {
  it('rolls monthly across a year boundary', () => {
    const rule: RecurrenceRuleLike = { ...base, generatedUntil: new Date('2026-11-10') };

    expect(iso(computeOccurrences(rule, new Date('2027-02-28')))).toEqual(['2026-12-10', '2027-01-10', '2027-02-10']);
  });

  it('keeps the start month for a yearly rule', () => {
    const rule: RecurrenceRuleLike = { ...base, frequency: 'YEARLY', startDate: new Date('2026-03-15'), dayOfMonth: 15 };

    expect(iso(computeOccurrences(rule, new Date('2029-01-01')))).toEqual(['2026-03-15', '2027-03-15', '2028-03-15']);
  });

  it('clamps dayOfMonth = 31 across Jan -> Feb -> Mar -> Apr in a non-leap year', () => {
    const rule: RecurrenceRuleLike = { ...base, dayOfMonth: 31, startDate: new Date('2027-01-31') };

    expect(iso(computeOccurrences(rule, new Date('2027-04-30')))).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('clamps dayOfMonth = 31 to the 29th in a leap year February', () => {
    const rule: RecurrenceRuleLike = { ...base, dayOfMonth: 31, startDate: new Date('2028-01-31') };

    expect(iso(computeOccurrences(rule, new Date('2028-02-29')))).toEqual(['2028-01-31', '2028-02-29']);
  });

  it('starts from startDate on the first run', () => {
    const rule: RecurrenceRuleLike = { ...base, startDate: new Date('2026-05-10') };

    expect(iso(computeOccurrences(rule, new Date('2026-07-10')))).toEqual(['2026-05-10', '2026-06-10', '2026-07-10']);
  });

  it('starts one step after generatedUntil on a subsequent run', () => {
    const rule: RecurrenceRuleLike = { ...base, generatedUntil: new Date('2026-05-10') };

    expect(iso(computeOccurrences(rule, new Date('2026-07-10')))).toEqual(['2026-06-10', '2026-07-10']);
  });

  it('terminates at until', () => {
    const rule: RecurrenceRuleLike = { ...base };

    expect(iso(computeOccurrences(rule, new Date('2026-03-09')))).toEqual(['2026-01-10', '2026-02-10']);
  });

  it('terminates at endDate', () => {
    const rule: RecurrenceRuleLike = { ...base, endDate: new Date('2026-02-10') };

    expect(iso(computeOccurrences(rule, new Date('2026-06-10')))).toEqual(['2026-01-10', '2026-02-10']);
  });

  it('terminates at totalOccurrences', () => {
    const rule: RecurrenceRuleLike = { ...base, totalOccurrences: 2 };

    expect(iso(computeOccurrences(rule, new Date('2026-12-10')))).toEqual(['2026-01-10', '2026-02-10']);
  });

  it('honours totalOccurrences already generated in earlier runs', () => {
    const rule: RecurrenceRuleLike = { ...base, totalOccurrences: 3, generatedUntil: new Date('2026-02-10') };

    expect(iso(computeOccurrences(rule, new Date('2026-12-10'), 2))).toEqual(['2026-03-10']);
  });

  it('returns [] once totalOccurrences has already been reached', () => {
    const rule: RecurrenceRuleLike = { ...base, totalOccurrences: 2, generatedUntil: new Date('2026-02-10') };

    expect(computeOccurrences(rule, new Date('2026-12-10'), 2)).toEqual([]);
  });

  it('returns [] for an inactive rule', () => {
    const rule: RecurrenceRuleLike = { ...base, isActive: false };

    expect(computeOccurrences(rule, new Date('2026-12-10'))).toEqual([]);
  });
});

describe('referenceMonthFor', () => {
  it('normalizes an occurrence date to the first of its month, UTC', () => {
    expect(referenceMonthFor(new Date('2026-02-28')).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});

import { fingerprint, parseRows } from './csv-import.service';

const model = { headerLineCount: 1, separator: ';', dateHeader: 'Date', descriptionHeader: 'Description', amountHeader: 'Amount' };

describe('CSV import parser', () => {
  it('handles BOM, quoted newlines, strict dates, and integer cents', () => {
    const result = parseRows(Buffer.from('\uFEFFDate;Description;Amount\n01-08-2026;"Coffee\nshop";-3.50\n31-02-2026;Bad;2.00\n'), model);

    expect(result.rows).toEqual([{ line: 2, date: new Date('2026-08-01'), description: 'Coffee\nshop', amount: 350, type: 'EXPENSE' }]);
    expect(result.invalid).toEqual([{ line: 4, reason: 'Invalid date.' }]);
  });

  it('normalizes only outer and internal whitespace for duplicate matching', () => {
    expect(fingerprint(new Date('2026-08-01'), 'EXPENSE', 350, '  Coffee\t Shop  ')).toBe(fingerprint(new Date('2026-08-01'), 'EXPENSE', 350, 'coffee shop'));
  });
});

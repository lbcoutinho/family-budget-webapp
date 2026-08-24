import { type HttpException } from '@nestjs/common';

import { fingerprint, parseRows } from './csv-import.service';

const model = { headerLineCount: 1, separator: ';', dateHeader: 'Date', descriptionHeader: 'Description', amountHeader: 'Amount' };

describe('CSV import parser', () => {
  it('handles BOM, quoted newlines, strict dates, and integer cents', () => {
    const result = parseRows(Buffer.from('\uFEFFDate;Description;Amount\n01-08-2026;"Coffee\nshop";-3.50\n31-02-2026;Bad;2.00\n'), model);

    expect(result.rows).toEqual([{ line: 2, date: new Date('2026-08-01'), description: 'Coffee\nshop', amount: 350, type: 'EXPENSE' }]);
    expect(result.invalid).toEqual([{ line: 4, date: '31-02-2026', description: 'Bad', amount: 200, type: 'INCOME', reason: 'INVALID_DATE' }]);
  });

  it('keeps the physical start line for CRLF multiline fields', () => {
    const result = parseRows(Buffer.from('Date;Description;Amount\r\n01-08-2026;"Coffee\r\nshop";-3.50\r\n'), model);

    expect(result.rows[0]?.line).toBe(2);
  });

  it('normalizes only outer and internal whitespace for duplicate matching', () => {
    expect(fingerprint(new Date('2026-08-01'), 'EXPENSE', 350, '  Coffee\t Shop  ')).toBe(fingerprint(new Date('2026-08-01'), 'EXPENSE', 350, 'coffee shop'));
  });

  it.each([
    ['file too large', Buffer.alloc(5 * 1024 * 1024 + 1), model, 'CSV_IMPORT_FILE_TOO_LARGE'],
    ['non-UTF-8 file', Buffer.from([0xff]), model, 'CSV_IMPORT_FILE_NOT_UTF8'],
    ['invalid CSV', Buffer.from('Date;Description;Amount\n"unclosed'), model, 'CSV_IMPORT_FILE_INVALID'],
    ['too many rows', Buffer.from(`Date;Description;Amount\n${'01-08-2026;Coffee;3.50\n'.repeat(10_000)}`), model, 'CSV_IMPORT_TOO_MANY_ROWS'],
    ['missing header line', Buffer.from('Date;Description;Amount\n'), { ...model, headerLineCount: 2 }, 'CSV_IMPORT_HEADER_LINE_MISSING'],
    ['empty transaction rows', Buffer.from('Date;Description;Amount\n'), model, 'CSV_IMPORT_NO_TRANSACTION_ROWS'],
    [
      'missing mapped header',
      Buffer.from('Date;Description;Amount\n01-08-2026;Coffee;3.50\n'),
      { ...model, amountHeader: 'Value' },
      'CSV_IMPORT_MAPPED_HEADER_MISSING',
    ],
    ['ambiguous mapped header', Buffer.from('Date;Description;Amount;Amount\n01-08-2026;Coffee;3.50;3.50\n'), model, 'CSV_IMPORT_MAPPED_HEADER_AMBIGUOUS'],
  ])('assigns %s a stable error code', (_name, file, csvModel, code) => {
    try {
      parseRows(file, csvModel);
      throw new Error('Expected CSV parsing to fail.');
    } catch (error) {
      expect((error as HttpException).getResponse()).toMatchObject({ code });
    }
  });
});

import { type HttpException } from '@nestjs/common';

import { type PrismaService } from '../../prisma/prisma.service';

import { CsvImportService, fingerprint, parseRows } from './csv-import.service';

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

describe('CSV import dates', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const dto = { modelId: '22222222-2222-2222-2222-222222222222', accountId: '33333333-3333-3333-3333-333333333333' };
  const csv = Buffer.from('Date;Description;Amount\n02-07-2026;Existing;-1.00\n03-07-2026;Bank row;12.34\n');

  function serviceDouble() {
    const created: { data: Record<string, unknown>[] }[] = [];
    const transaction = {
      findMany: jest.fn().mockResolvedValue([{ date: new Date('2026-07-02'), type: 'EXPENSE', amount: 100, description: 'Existing' }]),
      createMany: jest.fn((args: { data: Record<string, unknown>[] }) => {
        created.push(args);
        return Promise.resolve({ count: 1 });
      }),
    };
    const db = {
      $executeRaw: jest.fn(),
      csvImportModel: { findUnique: jest.fn().mockResolvedValue({ ...model, id: dto.modelId, userId }) },
      account: { findFirst: jest.fn().mockResolvedValue({ id: dto.accountId }) },
      transaction,
    };
    const prisma = { ...db, $transaction: jest.fn((callback: (tx: typeof db) => unknown) => callback(db)) } as unknown as PrismaService;

    return { service: new CsvImportService(prisma), created };
  }

  it('keeps bank dates in the preview and creates drafts settled on those dates', async () => {
    const { service, created } = serviceDouble();

    await expect(service.preview(userId, dto, csv)).resolves.toMatchObject({
      new: [{ line: 3, date: '2026-07-03', description: 'Bank row' }],
      duplicate: [{ line: 2, date: '2026-07-02', description: 'Existing' }],
    });
    await service.confirm(userId, { ...dto, selectedLines: [3] }, csv);

    const row = created[0]?.data[0];
    expect(row).toMatchObject({
      date: new Date('2026-07-03'),
      settlementDate: new Date('2026-07-03'),
      referenceMonth: new Date('2026-07-01'),
      status: 'DRAFT',
      source: 'IMPORT_CSV',
    });
    expect(row).not.toHaveProperty('isCreditCard');
  });
});

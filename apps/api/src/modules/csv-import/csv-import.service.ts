import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { badRequest, notFound } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfMonthUtc } from '../transactions/reference-month';

import { type ConfirmCsvImportDto, type CsvImportRequestDto } from './dto/csv-import-request.dto';
import { type CsvImportResultDto, type CsvImportRowDto } from './dto/csv-import-result.dto';

const MAX_ROWS = 10_000;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CENTS = 2_147_483_647n;
const IMPORT_LOCK_NAMESPACE = 230_00;

type Db = PrismaService | Prisma.TransactionClient;
interface Row {
  line: number;
  date: Date;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
}
type Outcome = CsvImportResultDto & { rows: Row[] };

@Injectable()
export class CsvImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(userId: string, dto: CsvImportRequestDto, file: Buffer | undefined): Promise<CsvImportResultDto> {
    return this.result(await this.prepare(userId, dto, file, this.prisma));
  }

  async confirm(userId: string, dto: ConfirmCsvImportDto, file: Buffer | undefined): Promise<CsvImportResultDto> {
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_NAMESPACE}, hashtext(${dto.accountId}))`);
        const prepared = await this.prepare(userId, dto, file, tx);
        const selected = new Set(dto.selectedLines);
        const newRows = prepared.rows.filter((row) => selected.has(row.line));

        if (newRows.length > 0) {
          await tx.transaction.createMany({
            data: newRows.map((row) => ({
              userId,
              accountId: dto.accountId,
              date: row.date,
              referenceMonth: startOfMonthUtc(row.date),
              description: row.description,
              amount: row.amount,
              type: row.type,
              status: 'DRAFT',
              source: 'IMPORT_CSV',
            })),
          });
        }

        return {
          ...prepared,
          new: prepared.new.filter((row) => selected.has(row.line)),
          notSelected: prepared.new.filter((row) => !selected.has(row.line)),
        };
      },
      { isolationLevel: 'Serializable' },
    );

    return this.result(outcome);
  }

  private async prepare(userId: string, dto: CsvImportRequestDto, file: Buffer | undefined, db: Db): Promise<Outcome> {
    if (file === undefined) {
      throw badRequest('CSV_IMPORT_FILE_REQUIRED', 'A CSV file is required.');
    }

    const model = assertOwnership(await db.csvImportModel.findUnique({ where: { id: dto.modelId } }), userId);
    const account = await db.account.findFirst({ where: { id: dto.accountId, userId, isActive: true }, select: { id: true } });

    if (account === null) {
      throw notFound('RECORD_NOT_FOUND', 'No active account found.');
    }

    const parsed = parseRows(file, model);
    const existing = await db.transaction.findMany({
      where: { accountId: dto.accountId },
      select: { date: true, type: true, amount: true, description: true },
    });
    const counts = new Map<string, number>();

    for (const transaction of existing) {
      if (transaction.amount !== null && (transaction.type === 'INCOME' || transaction.type === 'EXPENSE')) {
        const key = fingerprint(transaction.date, transaction.type, transaction.amount, transaction.description);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const seen = new Map<string, number>();
    const outcome: Outcome = { new: [], duplicate: [], invalid: parsed.invalid, notSelected: [], rows: [] };

    for (const row of parsed.rows) {
      const key = fingerprint(row.date, row.type, row.amount, row.description);
      const occurrence = (seen.get(key) ?? 0) + 1;
      seen.set(key, occurrence);

      if (occurrence <= (counts.get(key) ?? 0)) {
        outcome.duplicate.push(resultRow(row));
      } else {
        outcome.new.push(resultRow(row));
        outcome.rows.push(row);
      }
    }

    return outcome;
  }

  private result({ rows: _rows, ...result }: Outcome): CsvImportResultDto {
    return result;
  }
}

export function parseRows(
  file: Buffer,
  model: { headerLineCount: number; separator: string; dateHeader: string; descriptionHeader: string; amountHeader: string },
): { rows: Row[]; invalid: CsvImportResultDto['invalid'] } {
  if (file.length > MAX_FILE_SIZE) {
    throw badRequest('CSV_IMPORT_FILE_TOO_LARGE', 'CSV files can be at most 5 MB.');
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file);
  } catch {
    throw badRequest('CSV_IMPORT_FILE_NOT_UTF8', 'CSV files must be UTF-8 encoded.');
  }
  text = text.replace(/\r\n?|\n/g, '\n');

  let records: { record: string[]; info: { lines: number }; raw: string }[];
  try {
    records = parse(text, {
      bom: true,
      delimiter: model.separator,
      info: true,
      raw: true,
      relax_column_count: true,
      skip_empty_lines: true,
    }) as unknown as typeof records;
  } catch {
    throw badRequest('CSV_IMPORT_FILE_INVALID', 'The file is not valid CSV.');
  }

  if (records.length > MAX_ROWS) {
    throw badRequest('CSV_IMPORT_TOO_MANY_ROWS', `CSV files can contain at most ${MAX_ROWS} rows.`);
  }

  const header = records[model.headerLineCount - 1];
  if (header === undefined) {
    throw badRequest('CSV_IMPORT_HEADER_LINE_MISSING', 'The configured header line is missing.');
  }

  const columns = mappedColumns(header.record, model);
  const data = records.slice(model.headerLineCount);
  if (data.length === 0) {
    throw badRequest('CSV_IMPORT_NO_TRANSACTION_ROWS', 'The file has no transaction rows.');
  }

  const rows: Row[] = [];
  const invalid: CsvImportResultDto['invalid'] = [];
  for (const record of data) {
    const line = record.info.lines - (record.raw.replace(/(?:\r\n|\r|\n)$/, '').match(/\r\n|\r|\n/g)?.length ?? 0);
    const dateValue = record.record[columns.date] ?? '';
    const amountValue = record.record[columns.amount];
    const date = parseDate(dateValue);
    const description = record.record[columns.description]?.trim() ?? '';
    const amount = parseAmount(amountValue);

    if (date === null || description === '' || amount === null) {
      invalid.push({
        line,
        date: dateValue,
        description: description || undefined,
        amount: amount === null ? undefined : Math.abs(amount),
        type: amount === null ? undefined : amount < 0 ? 'EXPENSE' : 'INCOME',
        reason: date === null ? 'INVALID_DATE' : description === '' ? 'DESCRIPTION_REQUIRED' : 'INVALID_AMOUNT',
      });
      continue;
    }

    rows.push({ line, date, description, amount: Math.abs(amount), type: amount < 0 ? 'EXPENSE' : 'INCOME' });
  }

  return { rows, invalid };
}

function resultRow(row: Row): CsvImportRowDto {
  return { line: row.line, date: row.date.toISOString().slice(0, 10), description: row.description, amount: row.amount, type: row.type };
}

function mappedColumns(
  header: string[],
  model: { dateHeader: string; descriptionHeader: string; amountHeader: string },
): { date: number; description: number; amount: number } {
  const index = (name: string): number => {
    const matches = header.reduce<number[]>((all, value, position) => (value === name ? [...all, position] : all), []);
    if (matches.length !== 1) {
      throw matches.length === 0
        ? badRequest('CSV_IMPORT_MAPPED_HEADER_MISSING', `Missing mapped header: ${name}.`)
        : badRequest('CSV_IMPORT_MAPPED_HEADER_AMBIGUOUS', `Mapped header is ambiguous: ${name}.`);
    }
    return matches[0]!;
  };

  return { date: index(model.dateHeader), description: index(model.descriptionHeader), amount: index(model.amountHeader) };
}

function parseDate(value: string | undefined): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? '');
  if (match === null) return null;

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? date : null;
}

function parseAmount(value: string | undefined): number | null {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value ?? '');
  if (match === null) return null;

  const cents = BigInt(match[2]!) * 100n + BigInt(match[3]!);
  if (cents === 0n || cents > MAX_CENTS) return null;
  return Number(match[1] === '-' ? -cents : cents);
}

export function fingerprint(date: Date, type: 'INCOME' | 'EXPENSE', amount: number, description: string): string {
  return `${date.toISOString().slice(0, 10)}|${type}|${amount}|${description.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}`;
}

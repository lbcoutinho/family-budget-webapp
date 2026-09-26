import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { badRequest } from '../../common/api-error';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BalancesService } from '../transactions/balances.service';

import { type InvestmentImportPreviewDto } from './dto/investment-import-preview.dto';

const headers = [
  'external_id',
  'executed_at_utc',
  'institution',
  'account',
  'acquired_instrument',
  'acquired_quantity',
  'disposed_instrument',
  'disposed_quantity',
  'fee_instrument',
  'fee_quantity',
  'fee_value_eur_cents',
  'asset_listing_ticker',
  'asset_listing_market',
  'execution_value_eur_cents',
  'notes',
] as const;
type Row = Record<(typeof headers)[number], string> & { line: number; columnCount: number };
type PreviewIssue = InvestmentImportPreviewDto['errors'][number];
interface Operation {
  row?: Row;
  accountId: string;
  accountName: string;
  kind: string;
  acquired: { id: string; code: string; type: string };
  acquiredQuantity: Prisma.Decimal;
  disposed: { id: string; code: string; type: string };
  disposedQuantity: Prisma.Decimal;
  fee?: { id: string; code: string; type: string };
  feeQuantity?: Prisma.Decimal;
  feeValue?: number;
  executionValue: number;
  executedAt: Date;
}

@Injectable()
export class InvestmentImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
  ) {}

  async preview(userId: string, file: Buffer | undefined): Promise<InvestmentImportPreviewDto> {
    if (!file) throw badRequest('CSV_IMPORT_FILE_REQUIRED', 'A CSV file is required.');
    let records: string[][];
    try {
      records = parse(new TextDecoder('utf-8', { fatal: true }).decode(file), { bom: true, relax_column_count: true, skip_empty_lines: true, trim: true });
    } catch {
      throw badRequest('CSV_IMPORT_FILE_INVALID', 'The file is not valid UTF-8 CSV.');
    }
    if (records.length < 2 || records[0]?.join(',') !== headers.join(','))
      throw badRequest('CSV_IMPORT_FILE_INVALID', 'The CSV headers do not match the normalized investment format.');
    const rows = records
      .slice(1)
      .map((record, index) =>
        Object.assign(Object.fromEntries(headers.map((header, column) => [header, record[column] ?? ''])), { line: index + 2, columnCount: record.length }),
      ) as unknown as Row[];
    const [accounts, instruments, institutions, listings, balances, trades] = await Promise.all([
      this.prisma.account.findMany({ where: { userId, isActive: true }, include: { financialInstitution: true } }),
      this.prisma.instrument.findMany({ where: { userId, isActive: true } }),
      this.prisma.financialInstitution.findMany({ where: { userId, isActive: true } }),
      this.prisma.assetListing.findMany({ where: { userId, isActive: true } }),
      this.balances.instrumentBalances(userId),
      this.prisma.investmentTrade.findMany({
        where: { userId },
        orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: {
          account: { select: { id: true, name: true, kind: true } },
          acquiredInstrument: { select: { id: true, code: true, type: true } },
          disposedInstrument: { select: { id: true, code: true, type: true } },
          feeInstrument: { select: { id: true, code: true, type: true } },
        },
      }),
    ]);
    const accountByName = new Map(accounts.map((item) => [item.name, item]));
    const instrumentByCode = new Map(instruments.map((item) => [item.code, item]));
    const institutionNames = new Set(institutions.map((item) => item.name));
    const listingByKey = new Map(listings.map((item) => [`${item.ticker}|${item.market}`, item]));
    const errors: PreviewIssue[] = [],
      warnings: PreviewIssue[] = [],
      seen = new Set<string>();
    const valid: {
      row: Row;
      accountId: string;
      accountName: string;
      kind: string;
      acquired: (typeof instruments)[number];
      disposed: (typeof instruments)[number];
      fee?: (typeof instruments)[number];
    }[] = [];
    for (const row of rows) {
      const rowErrors: PreviewIssue[] = [];
      const add = (code: string, message: string) => rowErrors.push({ line: row.line, code, message });
      if (row.columnCount !== headers.length) add('COLUMN_COUNT_INVALID', 'Every row must have exactly the normalized CSV columns.');
      if (!row.external_id) add('EXTERNAL_ID_REQUIRED', 'external_id is required.');
      else if (seen.has(row.external_id)) add('EXTERNAL_ID_DUPLICATE', 'external_id is repeated in this file.');
      else seen.add(row.external_id);
      if (!utc(row.executed_at_utc)) add('UTC_REQUIRED', 'executed_at_utc must be an ISO-8601 UTC timestamp ending in Z.');
      const account = accountByName.get(row.account);
      const acquired = instrumentByCode.get(row.acquired_instrument);
      const disposed = instrumentByCode.get(row.disposed_instrument);
      const fee = row.fee_instrument ? instrumentByCode.get(row.fee_instrument) : undefined;
      if (!account) add('ACCOUNT_UNKNOWN', 'account must name an active account.');
      if ((account?.financialInstitution?.name ?? '') !== row.institution || (row.institution !== '' && !institutionNames.has(row.institution))) {
        add('INSTITUTION_MISMATCH', 'institution must match the account financial institution.');
      }
      if (!acquired || !disposed || acquired.id === disposed.id)
        add('INSTRUMENT_INVALID', 'acquired and disposed instruments must be different active instrument codes.');
      if (!decimal(row.acquired_quantity) || !decimal(row.disposed_quantity))
        add('QUANTITY_INVALID', 'acquired and disposed quantities must be positive decimals with at most 18 places.');
      const hasFee = Boolean(row.fee_instrument || row.fee_quantity || row.fee_value_eur_cents);
      if (hasFee && (!fee || !decimal(row.fee_quantity) || !cents(row.fee_value_eur_cents)))
        add('FEE_INVALID', 'A fee requires an active instrument, positive quantity, and positive EUR cents value.');
      if (!cents(row.execution_value_eur_cents)) add('EXECUTION_VALUE_INVALID', 'execution_value_eur_cents must be positive integer cents.');
      if (row.notes.length > 1000) add('NOTES_INVALID', 'notes must be at most 1,000 characters.');
      if (row.asset_listing_ticker || row.asset_listing_market) {
        const listing = listingByKey.get(`${row.asset_listing_ticker}|${row.asset_listing_market}`);
        if (!listing || listing.instrumentId !== acquired?.id) add('LISTING_INVALID', 'The listing must be active and belong to the acquired instrument.');
      }
      if (rowErrors.length) errors.push(...rowErrors);
      else valid.push({ row, accountId: account!.id, accountName: account!.name, kind: account!.kind, acquired: acquired!, disposed: disposed!, fee });
    }
    const quantities = new Map(balances.map((item) => [`${item.accountId}|${item.instrumentId}`, new Prisma.Decimal(item.quantity)]));
    const operations: Operation[] = [
      ...trades.map((trade) => ({
        accountId: trade.account.id,
        accountName: trade.account.name,
        kind: trade.account.kind,
        acquired: trade.acquiredInstrument,
        acquiredQuantity: new Prisma.Decimal(trade.acquiredQuantity),
        disposed: trade.disposedInstrument,
        disposedQuantity: new Prisma.Decimal(trade.disposedQuantity),
        fee: trade.feeInstrument ?? undefined,
        feeQuantity: trade.feeQuantity === null ? undefined : new Prisma.Decimal(trade.feeQuantity),
        feeValue: trade.feeValue ?? undefined,
        executionValue: trade.executionValue,
        executedAt: trade.executedAt,
      })),
      ...valid.map((item) => ({
        row: item.row,
        accountId: item.accountId,
        accountName: item.accountName,
        kind: item.kind,
        acquired: item.acquired,
        acquiredQuantity: new Prisma.Decimal(item.row.acquired_quantity),
        disposed: item.disposed,
        disposedQuantity: new Prisma.Decimal(item.row.disposed_quantity),
        fee: item.fee,
        feeQuantity: item.fee ? new Prisma.Decimal(item.row.fee_quantity) : undefined,
        feeValue: item.fee ? Number(item.row.fee_value_eur_cents) : undefined,
        executionValue: Number(item.row.execution_value_eur_cents),
        executedAt: new Date(item.row.executed_at_utc),
      })),
    ];
    for (const trade of operations.filter((item) => item.row === undefined)) {
      for (const [instrument, quantity] of movements(trade)) {
        const key = `${trade.accountId}|${instrument.id}`;
        quantities.set(key, (quantities.get(key) ?? new Prisma.Decimal(0)).sub(quantity));
      }
    }
    const positions = new Map<
      string,
      { accountName: string; instrumentCode: string; quantity: Prisma.Decimal; remainingCost: Prisma.Decimal; realizedResult: Prisma.Decimal }
    >();
    let validRows = 0;
    for (const item of operations.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime() || (a.row?.line ?? 0) - (b.row?.line ?? 0))) {
      const changes = new Map<string, { instrument: typeof item.acquired; quantity: Prisma.Decimal }>();
      for (const [instrument, quantity] of movements(item)) {
        const current = changes.get(instrument.id);
        changes.set(instrument.id, { instrument, quantity: (current?.quantity ?? new Prisma.Decimal(0)).add(quantity) });
      }
      let insufficient = false;
      for (const { instrument, quantity } of changes.values()) {
        const key = `${item.accountId}|${instrument.id}`;
        const next = (quantities.get(key) ?? new Prisma.Decimal(0)).add(quantity);
        if (item.row && item.kind !== 'BANK' && next.isNegative()) {
          errors.push({ line: item.row.line, code: 'INSUFFICIENT_FUNDS', message: `Insufficient ${instrument.code} for this operation.` });
          insufficient = true;
        }
      }
      if (insufficient) continue;
      for (const { instrument, quantity } of changes.values())
        quantities.set(`${item.accountId}|${instrument.id}`, (quantities.get(`${item.accountId}|${instrument.id}`) ?? new Prisma.Decimal(0)).add(quantity));
      const position = (instrument: typeof item.acquired) => {
        const key = `${item.accountId}|${instrument.id}`;
        const current = positions.get(key) ?? {
          accountName: item.accountName,
          instrumentCode: instrument.code,
          quantity: new Prisma.Decimal(0),
          remainingCost: new Prisma.Decimal(0),
          realizedResult: new Prisma.Decimal(0),
        };
        positions.set(key, current);
        return current;
      };
      if (asset(item.acquired.type)) {
        const current = position(item.acquired);
        current.quantity = current.quantity.add(item.acquiredQuantity);
        current.remainingCost = current.remainingCost.add(item.executionValue).add(item.feeValue ?? 0);
      }
      if (asset(item.disposed.type)) {
        const current = position(item.disposed);
        const cost = current.quantity.isZero() ? new Prisma.Decimal(0) : current.remainingCost.mul(item.disposedQuantity).div(current.quantity);
        current.quantity = current.quantity.sub(item.disposedQuantity);
        current.remainingCost = current.remainingCost.sub(cost);
        current.realizedResult = current.realizedResult
          .add(item.executionValue)
          .sub(item.fee?.id === item.disposed.id ? (item.feeValue ?? 0) : 0)
          .sub(cost);
      }
      if (item.fee && asset(item.fee.type)) {
        const current = position(item.fee);
        const cost = current.quantity.isZero() ? new Prisma.Decimal(0) : current.remainingCost.mul(item.feeQuantity!).div(current.quantity);
        current.quantity = current.quantity.sub(item.feeQuantity!);
        current.remainingCost = current.remainingCost.sub(cost);
        current.realizedResult = current.realizedResult.add(item.fee.id === item.disposed.id ? 0 : (item.feeValue ?? 0)).sub(cost);
      }
      if (item.row) validRows += 1;
    }
    return {
      validRows,
      errors,
      warnings,
      balances: [...quantities.entries()].map(([key, quantity]) => {
        const [accountId, instrumentId] = key.split('|');
        return {
          accountName: accounts.find((item) => item.id === accountId)?.name ?? '',
          instrumentCode: instruments.find((item) => item.id === instrumentId)?.code ?? '',
          quantity: quantity.toString(),
        };
      }),
      positions: [...positions.values()].map((item) => ({
        accountName: item.accountName,
        instrumentCode: item.instrumentCode,
        quantity: item.quantity.toString(),
        remainingCost: item.remainingCost.toDecimalPlaces(0).toNumber(),
        realizedResult: item.realizedResult.toDecimalPlaces(0).toNumber(),
      })),
    };
  }
}
function decimal(value: string): boolean {
  return /^\d+(?:\.\d{1,18})?$/.test(value) && new Prisma.Decimal(value).gt(0);
}
function cents(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2_147_483_647;
}
function utc(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  return match !== null && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
}
function movements(operation: Operation): (readonly [Operation['acquired'], Prisma.Decimal])[] {
  return [
    [operation.acquired, operation.acquiredQuantity],
    [operation.disposed, operation.disposedQuantity.negated()],
    ...(operation.fee && operation.feeQuantity ? [[operation.fee, operation.feeQuantity.negated()] as const] : []),
  ];
}
function asset(type: string): boolean {
  return type !== 'FIAT' && type !== 'STABLECOIN';
}

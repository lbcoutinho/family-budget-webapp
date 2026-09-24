import { Injectable } from '@nestjs/common';

import { badRequest, conflict } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { InstrumentType, Prisma, type AssetListing, type FinancialInstitution, type Instrument, type InvestmentTrade } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BalancesService } from '../transactions/balances.service';

import { AssetListingDto } from './dto/asset-listing.dto';
import { CreateAssetListingDto } from './dto/create-asset-listing.dto';
import { CreateFinancialInstitutionDto } from './dto/create-financial-institution.dto';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { CreateInvestmentTradeDto } from './dto/create-investment-trade.dto';
import { FinancialInstitutionDto } from './dto/financial-institution.dto';
import { InstrumentDto } from './dto/instrument.dto';
import { InvestmentPositionDto } from './dto/investment-position.dto';
import { InvestmentTradeDto } from './dto/investment-trade.dto';
import { ListInvestmentSetupQueryDto } from './dto/list-investment-setup-query.dto';
import { UpdateAssetListingDto } from './dto/update-asset-listing.dto';
import { UpdateFinancialInstitutionDto } from './dto/update-financial-institution.dto';
import { UpdateInstrumentDto } from './dto/update-instrument.dto';

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
  ) {}

  async listInstitutions(userId: string, query: ListInvestmentSetupQueryDto): Promise<FinancialInstitutionDto[]> {
    return (
      await this.prisma.financialInstitution.findMany({
        where: { userId, ...(query.includeInactive ? {} : { isActive: true }) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    ).map(toInstitutionDto);
  }
  async createInstitution(userId: string, dto: CreateFinancialInstitutionDto): Promise<FinancialInstitutionDto> {
    return toInstitutionDto(await this.prisma.financialInstitution.create({ data: { ...dto, userId } }));
  }
  async updateInstitution(userId: string, id: string, dto: UpdateFinancialInstitutionDto): Promise<FinancialInstitutionDto> {
    await this.institution(userId, id);
    return toInstitutionDto(await this.prisma.financialInstitution.update({ where: { id }, data: dto }));
  }
  async setInstitutionActive(userId: string, id: string, isActive: boolean): Promise<FinancialInstitutionDto> {
    await this.institution(userId, id);
    return toInstitutionDto(await this.prisma.financialInstitution.update({ where: { id }, data: { isActive } }));
  }
  async removeInstitution(userId: string, id: string): Promise<void> {
    await this.institution(userId, id);
    await this.prisma.financialInstitution.delete({ where: { id } });
  }

  async listInstruments(userId: string, query: ListInvestmentSetupQueryDto): Promise<InstrumentDto[]> {
    return (
      await this.prisma.instrument.findMany({
        where: { userId, ...(query.includeInactive ? {} : { isActive: true }) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    ).map(toInstrumentDto);
  }
  async createInstrument(userId: string, dto: CreateInstrumentDto): Promise<InstrumentDto> {
    return toInstrumentDto(await this.prisma.instrument.create({ data: { ...dto, userId } }));
  }
  async updateInstrument(userId: string, id: string, dto: UpdateInstrumentDto): Promise<InstrumentDto> {
    await this.instrument(userId, id);
    return toInstrumentDto(await this.prisma.instrument.update({ where: { id }, data: dto }));
  }
  async setInstrumentActive(userId: string, id: string, isActive: boolean): Promise<InstrumentDto> {
    await this.instrument(userId, id);
    if (!isActive) {
      await this.prisma.assetListing.updateMany({ where: { userId, OR: [{ instrumentId: id }, { quoteInstrumentId: id }] }, data: { isActive: false } });
    }
    return toInstrumentDto(await this.prisma.instrument.update({ where: { id }, data: { isActive } }));
  }
  async removeInstrument(userId: string, id: string): Promise<void> {
    await this.instrument(userId, id);
    await this.prisma.instrument.delete({ where: { id } });
  }

  async listListings(userId: string, query: ListInvestmentSetupQueryDto): Promise<AssetListingDto[]> {
    return (
      await this.prisma.assetListing.findMany({
        where: { userId, ...(query.includeInactive ? {} : { isActive: true }) },
        include: listingInclude,
        orderBy: [{ sortOrder: 'asc' }, { market: 'asc' }, { ticker: 'asc' }],
      })
    ).map(toListingDto);
  }
  async createListing(userId: string, dto: CreateAssetListingDto): Promise<AssetListingDto> {
    await this.assertActiveInstruments(userId, dto.instrumentId, dto.quoteInstrumentId);
    return toListingDto(await this.prisma.assetListing.create({ data: { ...dto, userId }, include: listingInclude }));
  }
  async updateListing(userId: string, id: string, dto: UpdateAssetListingDto): Promise<AssetListingDto> {
    await this.listing(userId, id);
    if (dto.instrumentId !== undefined) await this.assertActiveInstruments(userId, dto.instrumentId);
    if (dto.quoteInstrumentId !== undefined) await this.assertActiveInstruments(userId, dto.quoteInstrumentId);
    return toListingDto(await this.prisma.assetListing.update({ where: { id }, data: dto, include: listingInclude }));
  }
  async setListingActive(userId: string, id: string, isActive: boolean): Promise<AssetListingDto> {
    const listing = await this.listing(userId, id);
    if (isActive) await this.assertActiveInstruments(userId, listing.instrumentId, listing.quoteInstrumentId);
    return toListingDto(await this.prisma.assetListing.update({ where: { id }, data: { isActive }, include: listingInclude }));
  }
  async removeListing(userId: string, id: string): Promise<void> {
    await this.listing(userId, id);
    await this.prisma.assetListing.delete({ where: { id } });
  }

  async listTrades(userId: string): Promise<InvestmentTradeDto[]> {
    return (
      await this.prisma.investmentTrade.findMany({ where: { userId }, include: tradeInclude, orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }] })
    ).map(toTradeDto);
  }

  async listPositions(userId: string): Promise<InvestmentPositionDto[]> {
    const trades = await this.prisma.investmentTrade.findMany({
      where: { userId },
      include: positionTradeInclude,
      orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    const positions = new Map<string, Position>();

    for (const trade of trades) {
      if (isInvestmentAsset(trade.acquiredInstrument.type)) {
        const position = positionFor(positions, trade.account, trade.acquiredInstrument);
        position.quantity = position.quantity.add(trade.acquiredQuantity);
        position.remainingCost = position.remainingCost.add(trade.executionValue).add(trade.feeValue ?? 0);
      }
      if (isInvestmentAsset(trade.disposedInstrument.type)) {
        const position = positionFor(positions, trade.account, trade.disposedInstrument);
        const removedCost = position.quantity.isZero() ? new Prisma.Decimal(0) : position.remainingCost.mul(trade.disposedQuantity).div(position.quantity);
        position.quantity = position.quantity.sub(trade.disposedQuantity);
        position.remainingCost = position.remainingCost.sub(removedCost);
        position.realizedResult = position.realizedResult
          .add(trade.executionValue)
          .sub(trade.feeInstrumentId === trade.disposedInstrumentId ? (trade.feeValue ?? 0) : 0)
          .sub(removedCost);
      }
      if (trade.feeInstrument && trade.feeQuantity && isInvestmentAsset(trade.feeInstrument.type)) {
        const position = positionFor(positions, trade.account, trade.feeInstrument);
        const removedCost = position.quantity.isZero() ? new Prisma.Decimal(0) : position.remainingCost.mul(trade.feeQuantity).div(position.quantity);
        position.quantity = position.quantity.sub(trade.feeQuantity);
        position.remainingCost = position.remainingCost.sub(removedCost);
        position.realizedResult = position.realizedResult
          .add(trade.feeInstrumentId === trade.disposedInstrumentId ? 0 : (trade.feeValue ?? 0))
          .sub(removedCost);
      }
    }

    const consolidated = new Map<string, Position>();
    for (const position of positions.values()) {
      const total = positionFor(consolidated, null, position.instrument);
      total.quantity = total.quantity.add(position.quantity);
      total.remainingCost = total.remainingCost.add(position.remainingCost);
      total.realizedResult = total.realizedResult.add(position.realizedResult);
    }
    return [...consolidated.values(), ...positions.values()].map(toPositionDto);
  }

  async createTrade(userId: string, dto: CreateInvestmentTradeDto): Promise<InvestmentTradeDto> {
    if (dto.acquiredInstrumentId === dto.disposedInstrumentId) {
      throw badRequest('INVESTMENT_TRADE_SAME_INSTRUMENT', 'A trade must acquire and dispose different instruments.');
    }

    const hasFee = dto.feeInstrumentId !== undefined || dto.feeQuantity !== undefined || dto.feeValue !== undefined;
    if (hasFee && (dto.feeInstrumentId === undefined || dto.feeQuantity === undefined || dto.feeValue === undefined)) {
      throw badRequest('INVESTMENT_REFERENCE_INACTIVE', 'A trade fee requires its instrument, quantity, and EUR value.');
    }
    const [account, acquired, disposed, fee, listing] = await Promise.all([
      this.prisma.account.findFirst({ where: { id: dto.accountId, userId, isActive: true } }),
      this.prisma.instrument.findFirst({ where: { id: dto.acquiredInstrumentId, userId, isActive: true } }),
      this.prisma.instrument.findFirst({ where: { id: dto.disposedInstrumentId, userId, isActive: true } }),
      dto.feeInstrumentId === undefined ? undefined : this.prisma.instrument.findFirst({ where: { id: dto.feeInstrumentId, userId, isActive: true } }),
      dto.assetListingId === undefined ? undefined : this.prisma.assetListing.findFirst({ where: { id: dto.assetListingId, userId, isActive: true } }),
    ]);
    if (!account || !acquired || !disposed || (dto.feeInstrumentId !== undefined && !fee) || (dto.assetListingId !== undefined && !listing)) {
      throw badRequest('INVESTMENT_REFERENCE_INACTIVE', 'An active account and instruments are required.');
    }
    if (listing && listing.instrumentId !== dto.acquiredInstrumentId) {
      throw badRequest('INVESTMENT_TRADE_LISTING_MISMATCH', 'The listing must belong to the acquired instrument.');
    }

    const acquiredQuantity = new Prisma.Decimal(dto.acquiredQuantity);
    const disposedQuantity = new Prisma.Decimal(dto.disposedQuantity);
    const feeQuantity = dto.feeQuantity === undefined ? undefined : new Prisma.Decimal(dto.feeQuantity);
    if (!acquiredQuantity.gt(0) || !disposedQuantity.gt(0) || (feeQuantity && !feeQuantity.gt(0))) {
      throw badRequest('INVESTMENT_REFERENCE_INACTIVE', 'Trade quantities must be positive.');
    }
    return toTradeDto(
      await this.prisma.$transaction(async (tx) => {
        if (account.kind !== 'BANK') {
          const movements = new Map<string, Prisma.Decimal>([
            [acquired.id, acquiredQuantity],
            [disposed.id, disposedQuantity.negated()],
          ]);
          if (fee && feeQuantity) movements.set(fee.id, (movements.get(fee.id) ?? new Prisma.Decimal(0)).sub(feeQuantity));
          for (const [instrumentId, movement] of movements) {
            if (movement.isNegative()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${account.id}:${instrumentId}`}))`;
          }
          const balances = await this.balances.instrumentBalances(userId, undefined, tx);
          for (const [instrumentId, movement] of movements) {
            if (!movement.isNegative()) continue;
            const held =
              balances.find((balance) => balance.accountId === account.id && balance.instrumentId === instrumentId)?.quantity ?? new Prisma.Decimal(0);
            if (held.add(movement).isNegative()) {
              const instrument = instrumentId === disposed.id ? disposed : fee!;
              throw conflict('INVESTMENT_TRADE_INSUFFICIENT_FUNDS', `Insufficient ${instrument.code}: ${held.toString()} available.`, {
                instrumentCode: instrument.code,
                availableQuantity: held.toString(),
              });
            }
          }
        }
        return tx.investmentTrade.create({
          data: { ...dto, userId, acquiredQuantity, disposedQuantity, feeQuantity, executedAt: new Date(dto.executedAt) },
          include: tradeInclude,
        });
      }),
    );
  }

  private async assertActiveInstruments(userId: string, ...ids: string[]): Promise<void> {
    const active = await this.prisma.instrument.count({ where: { userId, isActive: true, id: { in: ids } } });
    if (active !== new Set(ids).size) throw badRequest('INVESTMENT_REFERENCE_INACTIVE', 'An active instrument is required.');
  }
  private async institution(userId: string, id: string): Promise<FinancialInstitution> {
    return assertOwnership(await this.prisma.financialInstitution.findUnique({ where: { id } }), userId);
  }
  private async instrument(userId: string, id: string): Promise<Instrument> {
    return assertOwnership(await this.prisma.instrument.findUnique({ where: { id } }), userId);
  }
  private async listing(userId: string, id: string): Promise<AssetListing> {
    return assertOwnership(await this.prisma.assetListing.findUnique({ where: { id } }), userId);
  }
}

const tradeInclude = {
  account: { select: { name: true } },
  acquiredInstrument: { select: { name: true, code: true, displayPrecision: true } },
  disposedInstrument: { select: { name: true, code: true, displayPrecision: true } },
  feeInstrument: { select: { name: true, code: true, displayPrecision: true } },
  assetListing: { select: { market: true, ticker: true } },
} as const;
const positionTradeInclude = {
  account: { select: { id: true, name: true } },
  acquiredInstrument: { select: { id: true, name: true, code: true, type: true, displayPrecision: true } },
  disposedInstrument: { select: { id: true, name: true, code: true, type: true, displayPrecision: true } },
  feeInstrument: { select: { id: true, name: true, code: true, type: true, displayPrecision: true } },
} as const;
type TradeRow = InvestmentTrade & Prisma.InvestmentTradeGetPayload<{ include: typeof tradeInclude }>;
const toTradeDto = (trade: TradeRow): InvestmentTradeDto => ({
  id: trade.id,
  accountId: trade.accountId,
  accountName: trade.account.name,
  acquiredInstrumentId: trade.acquiredInstrumentId,
  acquiredInstrumentName: trade.acquiredInstrument.name,
  acquiredInstrumentCode: trade.acquiredInstrument.code,
  acquiredDisplayPrecision: trade.acquiredInstrument.displayPrecision,
  acquiredQuantity: trade.acquiredQuantity.toString(),
  disposedInstrumentId: trade.disposedInstrumentId,
  disposedInstrumentName: trade.disposedInstrument.name,
  disposedInstrumentCode: trade.disposedInstrument.code,
  disposedDisplayPrecision: trade.disposedInstrument.displayPrecision,
  disposedQuantity: trade.disposedQuantity.toString(),
  feeInstrumentId: trade.feeInstrumentId,
  feeInstrumentName: trade.feeInstrument?.name ?? null,
  feeInstrumentCode: trade.feeInstrument?.code ?? null,
  feeDisplayPrecision: trade.feeInstrument?.displayPrecision ?? null,
  feeQuantity: trade.feeQuantity?.toString() ?? null,
  feeValue: trade.feeValue,
  assetListingId: trade.assetListingId,
  assetListing: trade.assetListing ? `${trade.assetListing.ticker} · ${trade.assetListing.market}` : null,
  executedAt: trade.executedAt.toISOString(),
  executionValue: trade.executionValue,
  executionPrice: new Prisma.Decimal(trade.disposedQuantity).div(trade.acquiredQuantity).toFixed(12),
  notes: trade.notes,
  createdAt: trade.createdAt.toISOString(),
  updatedAt: trade.updatedAt.toISOString(),
});

const listingInclude = { instrument: { select: { name: true } }, quoteInstrument: { select: { code: true } } } as const;
const toInstitutionDto = (row: FinancialInstitution): FinancialInstitutionDto => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
const toInstrumentDto = (row: Instrument): InstrumentDto => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const toListingDto = (row: AssetListing & { instrument: { name: string }; quoteInstrument: { code: string } }): AssetListingDto => ({
  id: row.id,
  instrumentId: row.instrumentId,
  instrumentName: row.instrument.name,
  quoteInstrumentId: row.quoteInstrumentId,
  quoteInstrumentCode: row.quoteInstrument.code,
  market: row.market,
  ticker: row.ticker,
  isin: row.isin,
  providerSymbol: row.providerSymbol,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

interface PositionInstrument {
  id: string;
  name: string;
  code: string;
  type: InstrumentType;
  displayPrecision: number;
}
interface PositionAccount {
  id: string;
  name: string;
}
interface Position {
  account: PositionAccount | null;
  instrument: PositionInstrument;
  quantity: Prisma.Decimal;
  remainingCost: Prisma.Decimal;
  realizedResult: Prisma.Decimal;
}

function isInvestmentAsset(type: InstrumentType): boolean {
  return type !== 'FIAT' && type !== 'STABLECOIN';
}

function positionFor(positions: Map<string, Position>, account: PositionAccount | null, instrument: PositionInstrument): Position {
  const key = `${account?.id ?? 'consolidated'}:${instrument.id}`;
  const existing = positions.get(key);
  if (existing) return existing;
  const position: Position = {
    account,
    instrument,
    quantity: new Prisma.Decimal(0),
    remainingCost: new Prisma.Decimal(0),
    realizedResult: new Prisma.Decimal(0),
  };
  positions.set(key, position);
  return position;
}

function toPositionDto(position: Position): InvestmentPositionDto {
  return {
    accountId: position.account?.id ?? null,
    accountName: position.account?.name ?? null,
    instrumentId: position.instrument.id,
    instrumentName: position.instrument.name,
    instrumentCode: position.instrument.code,
    instrumentType: position.instrument.type,
    displayPrecision: position.instrument.displayPrecision,
    quantity: position.quantity.toString(),
    remainingCost: position.remainingCost.toDecimalPlaces(0).toNumber(),
    weightedAverageCost: position.quantity.isZero() ? '0.000000000000' : position.remainingCost.div(100).div(position.quantity).toFixed(12),
    realizedResult: position.realizedResult.toDecimalPlaces(0).toNumber(),
  };
}

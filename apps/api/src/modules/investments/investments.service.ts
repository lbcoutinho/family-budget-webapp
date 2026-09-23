import { Injectable } from '@nestjs/common';

import { badRequest } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type AssetListing, type FinancialInstitution, type Instrument } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { AssetListingDto } from './dto/asset-listing.dto';
import { CreateAssetListingDto } from './dto/create-asset-listing.dto';
import { CreateFinancialInstitutionDto } from './dto/create-financial-institution.dto';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { FinancialInstitutionDto } from './dto/financial-institution.dto';
import { InstrumentDto } from './dto/instrument.dto';
import { ListInvestmentSetupQueryDto } from './dto/list-investment-setup-query.dto';
import { UpdateAssetListingDto } from './dto/update-asset-listing.dto';
import { UpdateFinancialInstitutionDto } from './dto/update-financial-institution.dto';
import { UpdateInstrumentDto } from './dto/update-instrument.dto';

@Injectable()
export class InvestmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

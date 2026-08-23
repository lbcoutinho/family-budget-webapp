import { Injectable } from '@nestjs/common';

import { assertOwnership } from '../../common/assert-ownership';
import { type CsvImportModel } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateCsvImportModelDto } from './dto/create-csv-import-model.dto';
import { CsvImportModelDto } from './dto/csv-import-model.dto';

@Injectable()
export class CsvImportModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<CsvImportModelDto[]> {
    return (await this.prisma.csvImportModel.findMany({ where: { userId }, orderBy: { name: 'asc' } })).map(toDto);
  }

  async create(userId: string, dto: CreateCsvImportModelDto): Promise<CsvImportModelDto> {
    return toDto(await this.prisma.csvImportModel.create({ data: { ...dto, userId } }));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.load(userId, id);
    await this.prisma.csvImportModel.delete({ where: { id } });
  }

  private async load(userId: string, id: string): Promise<CsvImportModel> {
    return assertOwnership(await this.prisma.csvImportModel.findUnique({ where: { id } }), userId);
  }
}

function toDto(model: CsvImportModel): CsvImportModelDto {
  return {
    id: model.id,
    name: model.name,
    headerLineCount: model.headerLineCount,
    separator: model.separator as ',' | ';' | '\t',
    dateHeader: model.dateHeader,
    descriptionHeader: model.descriptionHeader,
    amountHeader: model.amountHeader,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}

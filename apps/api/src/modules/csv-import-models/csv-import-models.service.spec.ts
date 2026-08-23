import { NotFoundException } from '@nestjs/common';

import { type CsvImportModel } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';

import { CsvImportModelsService } from './csv-import-models.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const modelId = '33333333-3333-3333-3333-333333333333';

const row = (overrides: Partial<CsvImportModel> = {}): CsvImportModel => ({
  id: modelId,
  userId,
  name: 'Millennium',
  headerLineCount: 1,
  separator: ';',
  dateHeader: 'Date',
  descriptionHeader: 'Description',
  amountHeader: 'Amount',
  createdAt: new Date('2026-08-23T10:00:00.000Z'),
  updatedAt: new Date('2026-08-23T10:00:00.000Z'),
  ...overrides,
});

const prismaDouble = (): { prisma: PrismaService; model: Record<'findMany' | 'findUnique' | 'create' | 'delete', jest.Mock> } => {
  const model = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() };
  return { prisma: { csvImportModel: model } as unknown as PrismaService, model };
};

describe('CsvImportModelsService', () => {
  let service: CsvImportModelsService;
  let model: ReturnType<typeof prismaDouble>['model'];

  beforeEach(() => {
    const double = prismaDouble();
    service = new CsvImportModelsService(double.prisma);
    model = double.model;
  });

  it('lists only the caller’s models in stable name order', async () => {
    model.findMany.mockResolvedValue([row()]);

    await expect(service.findAll(userId)).resolves.toMatchObject([{ id: modelId, name: 'Millennium' }]);
    expect(model.findMany).toHaveBeenCalledWith({ where: { userId }, orderBy: { name: 'asc' } });
  });

  it('creates from the caller identity, not request data', async () => {
    model.create.mockResolvedValue(row());
    const dto = {
      name: 'Millennium',
      headerLineCount: 1,
      separator: ';' as const,
      dateHeader: 'Date',
      descriptionHeader: 'Description',
      amountHeader: 'Amount',
    };

    await service.create(userId, dto);

    expect(model.create).toHaveBeenCalledWith({ data: { ...dto, userId } });
  });

  it('answers 404 and does not delete another user’s model', async () => {
    model.findUnique.mockResolvedValue(row({ userId: otherUserId }));

    await expect(service.remove(userId, modelId)).rejects.toThrow(NotFoundException);
    expect(model.delete).not.toHaveBeenCalled();
  });

  it('deletes an owned model', async () => {
    model.findUnique.mockResolvedValue(row());
    model.delete.mockResolvedValue(row());

    await expect(service.remove(userId, modelId)).resolves.toBeUndefined();
    expect(model.delete).toHaveBeenCalledWith({ where: { id: modelId } });
  });
});

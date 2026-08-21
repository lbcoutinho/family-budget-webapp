import { BadRequestException, NotFoundException } from '@nestjs/common';

import { type RecurrenceRule } from '../../generated/prisma/client';
import { type PrismaService } from '../../prisma/prisma.service';
import { type TransactionValidator } from '../transactions/validators/transaction-validator';

import { type RecurrenceGeneratorService } from './recurrence-generator.service';
import { RecurrenceRulesService } from './recurrence-rules.service';

const userId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const ruleId = '33333333-3333-3333-3333-333333333333';
const accountId = '44444444-4444-4444-4444-444444444444';
const categoryId = '55555555-5555-5555-5555-555555555555';

const row = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  id: ruleId,
  userId,
  type: 'EXPENSE',
  amount: 1_000,
  description: 'Rent',
  notes: null,
  accountId,
  categoryId,
  subcategoryId: null,
  frequency: 'MONTHLY',
  interval: 1,
  dayOfMonth: 15,
  startDate: new Date('2026-01-15T00:00:00.000Z'),
  endDate: null,
  totalOccurrences: null,
  totalAmount: null,
  autoConfirm: true,
  isActive: true,
  generatedUntil: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  ...overrides,
});

const prismaDouble = (): {
  prisma: PrismaService;
  recurrenceRule: Record<'findMany' | 'findUnique' | 'create' | 'update' | 'delete', jest.Mock>;
  transactionCount: jest.Mock;
} => {
  const recurrenceRule = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const transactionCount = jest.fn().mockResolvedValue(0);

  return {
    prisma: { recurrenceRule, transaction: { count: transactionCount } } as unknown as PrismaService,
    recurrenceRule,
    transactionCount,
  };
};

describe('RecurrenceRulesService', () => {
  let service: RecurrenceRulesService;
  let recurrenceRule: ReturnType<typeof prismaDouble>['recurrenceRule'];
  let transactionCount: jest.Mock;
  let validate: jest.Mock;
  let generate: jest.Mock;

  beforeEach(() => {
    const double = prismaDouble();
    recurrenceRule = double.recurrenceRule;
    transactionCount = double.transactionCount;
    validate = jest.fn().mockResolvedValue({});
    generate = jest.fn().mockResolvedValue({ created: 0, generatedUntil: null });

    service = new RecurrenceRulesService(double.prisma, { validate } as unknown as TransactionValidator, { generate } as unknown as RecurrenceGeneratorService);
  });

  describe('ownership', () => {
    it.each([
      ['findOne', () => service.findOne(userId, ruleId)],
      ['update', () => service.update(userId, ruleId, { description: 'Renamed' })],
      ['remove', () => service.remove(userId, ruleId)],
      ['generate', () => service.generate(userId, ruleId)],
      ['preview', () => service.preview(userId, ruleId, 12)],
    ])("answers 404, not 403, when %s hits another user's rule", async (_name, call) => {
      recurrenceRule.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(call()).rejects.toThrow(NotFoundException);
      expect(recurrenceRule.update).not.toHaveBeenCalled();
      expect(recurrenceRule.delete).not.toHaveBeenCalled();
    });

    it('answers 404 for an id that does not exist at all', async () => {
      recurrenceRule.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, ruleId)).rejects.toThrow(NotFoundException);
    });
  });

  it('returns an installment plan total through the recurrence DTO', async () => {
    recurrenceRule.findUnique.mockResolvedValue(row({ totalOccurrences: 7, totalAmount: 100_000 }));

    await expect(service.findOne(userId, ruleId)).resolves.toMatchObject({ totalOccurrences: 7, totalAmount: 100_000 });
  });

  describe('create', () => {
    const dto = {
      type: 'EXPENSE' as const,
      amount: 1_000,
      description: 'Rent',
      accountId,
      categoryId,
      frequency: 'MONTHLY' as const,
      dayOfMonth: 15,
      startDate: new Date('2026-01-15T00:00:00.000Z'),
    };

    it('rejects endDate at or before startDate before touching the validator', async () => {
      await expect(service.create(userId, { ...dto, endDate: new Date('2026-01-15T00:00:00.000Z') })).rejects.toThrow(BadRequestException);
      await expect(service.create(userId, { ...dto, endDate: new Date('2026-01-01T00:00:00.000Z') })).rejects.toThrow(BadRequestException);
      expect(validate).not.toHaveBeenCalled();
    });

    it('surfaces an inactive or foreign account/category through the shared TransactionValidator', async () => {
      validate.mockRejectedValue(new BadRequestException('TRANSACTION_REFERENCE_INACTIVE'));

      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
      expect(validate).toHaveBeenCalledWith(userId, { type: 'EXPENSE', accountId, categoryId, subcategoryId: undefined }, { requireActive: true });
    });

    it('creates with the userId from the token, never from the body', async () => {
      recurrenceRule.create.mockResolvedValue(row());

      await service.create(userId, dto);

      expect(recurrenceRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId, type: 'EXPENSE', accountId, categoryId, interval: 1, autoConfirm: true }) as unknown,
      });
    });

    it('accepts a null amount when autoConfirm is false (ADR-0020)', async () => {
      recurrenceRule.create.mockResolvedValue(row({ amount: null, autoConfirm: false }));

      await service.create(userId, { ...dto, amount: null, autoConfirm: false });

      expect(recurrenceRule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ amount: null, autoConfirm: false }) as unknown,
      });
    });

    it('rejects a null amount when autoConfirm is true (the default), with 400 RECURRENCE_AMOUNT_REQUIRED_WHEN_AUTO_CONFIRM', async () => {
      await expect(service.create(userId, { ...dto, amount: null })).rejects.toThrow(BadRequestException);
      expect(recurrenceRule.create).not.toHaveBeenCalled();
    });

    it('rejects a null amount with autoConfirm explicitly true', async () => {
      await expect(service.create(userId, { ...dto, amount: null, autoConfirm: true })).rejects.toThrow(BadRequestException);
      expect(recurrenceRule.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects a patched endDate at or before the current startDate', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());

      await expect(service.update(userId, ruleId, { endDate: new Date('2026-01-01T00:00:00.000Z') })).rejects.toThrow(BadRequestException);
      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });

    it('skips the validator when the patch never touches a ref field or type', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());
      recurrenceRule.update.mockResolvedValue(row({ description: 'Renamed' }));

      await service.update(userId, ruleId, { description: 'Renamed' });

      expect(validate).not.toHaveBeenCalled();
    });

    it('re-validates against the merged refs when categoryId changes', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());
      recurrenceRule.update.mockResolvedValue(row());
      const newCategoryId = '66666666-6666-6666-6666-666666666666';

      await service.update(userId, ruleId, { categoryId: newCategoryId });

      expect(validate).toHaveBeenCalledWith(
        userId,
        { type: 'EXPENSE', accountId, categoryId: newCategoryId, subcategoryId: undefined },
        { requireActive: true },
      );
    });

    it('accepts clearing amount to null when the rule already has autoConfirm false', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ autoConfirm: false }));
      recurrenceRule.update.mockResolvedValue(row({ amount: null, autoConfirm: false }));

      await expect(service.update(userId, ruleId, { amount: null })).resolves.toMatchObject({ amount: null });
    });

    it('rejects clearing amount to null while autoConfirm stays true, with 400 RECURRENCE_AMOUNT_REQUIRED_WHEN_AUTO_CONFIRM', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ autoConfirm: true }));

      await expect(service.update(userId, ruleId, { amount: null })).rejects.toThrow(BadRequestException);
      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });

    it('rejects flipping autoConfirm to true on a rule whose amount is already null', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ amount: null, autoConfirm: false }));

      await expect(service.update(userId, ruleId, { autoConfirm: true })).rejects.toThrow(BadRequestException);
      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes outright when no transaction was ever generated', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());
      transactionCount.mockResolvedValue(0);

      await service.remove(userId, ruleId);

      expect(recurrenceRule.delete).toHaveBeenCalledWith({ where: { id: ruleId } });
      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });

    it('deactivates instead of deleting when generated transactions exist', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());
      recurrenceRule.update.mockResolvedValue(row({ isActive: false }));
      transactionCount.mockResolvedValue(3);

      await expect(service.remove(userId, ruleId)).resolves.toMatchObject({ isActive: false });

      expect(recurrenceRule.update).toHaveBeenCalledWith({ where: { id: ruleId }, data: { isActive: false } });
      expect(recurrenceRule.delete).not.toHaveBeenCalled();
    });
  });

  describe('generate', () => {
    it('loads the rule, then delegates to the generator', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());
      generate.mockResolvedValue({ created: 2, generatedUntil: new Date('2026-04-15T00:00:00.000Z') });

      await expect(service.generate(userId, ruleId)).resolves.toEqual({ created: 2, generatedUntil: '2026-04-15' });

      expect(generate).toHaveBeenCalledWith(userId, expect.objectContaining({ id: ruleId }), expect.any(Date));
    });
  });

  describe('preview', () => {
    it('never calls a write and returns pure-calculated occurrences', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ generatedUntil: null }));
      transactionCount.mockResolvedValue(0);

      const result = await service.preview(userId, ruleId, 3);

      expect(result.occurrences.length).toBeGreaterThan(0);
      expect(recurrenceRule.update).not.toHaveBeenCalled();
      expect(recurrenceRule.create).not.toHaveBeenCalled();
      expect(recurrenceRule.delete).not.toHaveBeenCalled();
    });

    it('respects totalOccurrences already consumed by earlier generation', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ totalOccurrences: 2, generatedUntil: new Date('2026-02-15T00:00:00.000Z') }));
      transactionCount.mockResolvedValue(2);

      const result = await service.preview(userId, ruleId, 12);

      expect(result.occurrences).toEqual([]);
    });
  });

  describe('previewPayload', () => {
    const payload = {
      frequency: 'MONTHLY' as const,
      dayOfMonth: 15,
      startDate: new Date('2026-01-15T00:00:00.000Z'),
    };

    it('never touches Prisma and returns the same occurrences the persisted-rule calculator would', () => {
      const result = service.previewPayload({ ...payload, months: 3 });

      expect(result.occurrences.length).toBeGreaterThan(0);
      expect(recurrenceRule.findUnique).not.toHaveBeenCalled();
      expect(recurrenceRule.create).not.toHaveBeenCalled();
      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });

    it('rejects an endDate at or before startDate before computing anything', () => {
      expect(() => service.previewPayload({ ...payload, endDate: new Date('2026-01-15T00:00:00.000Z') })).toThrow(BadRequestException);
    });

    it('defaults months to 12 and interval to 1 when omitted', () => {
      const withDefaults = service.previewPayload(payload);
      const explicit = service.previewPayload({ ...payload, interval: 1, months: 12 });

      expect(withDefaults.occurrences).toEqual(explicit.occurrences);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false and keeps the rule (never deletes it)', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row());
      recurrenceRule.update.mockResolvedValue(row({ isActive: false }));

      await expect(service.deactivate(userId, ruleId)).resolves.toMatchObject({ isActive: false });

      expect(recurrenceRule.update).toHaveBeenCalledWith({ where: { id: ruleId }, data: { isActive: false } });
      expect(recurrenceRule.delete).not.toHaveBeenCalled();
    });

    it('is idempotent: deactivating an already-inactive rule skips the write', async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ isActive: false }));

      await expect(service.deactivate(userId, ruleId)).resolves.toMatchObject({ isActive: false });

      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });

    it("answers 404, not 403, for another user's rule", async () => {
      recurrenceRule.findUnique.mockResolvedValue(row({ userId: otherUserId }));

      await expect(service.deactivate(userId, ruleId)).rejects.toThrow(NotFoundException);
      expect(recurrenceRule.update).not.toHaveBeenCalled();
    });
  });
});

import { Injectable } from '@nestjs/common';

import { badRequest } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Prisma, type RecurrenceRule } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type TransactionRefInput, TransactionValidator } from '../transactions/validators/transaction-validator';

import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { type GenerateRecurrenceRuleResultDto } from './dto/generate-recurrence-rule-result.dto';
import { ListRecurrenceRulesQueryDto } from './dto/list-recurrence-rules-query.dto';
import { type PreviewRecurrenceRulePayloadDto } from './dto/preview-recurrence-rule-payload.dto';
import { type PreviewRecurrenceRuleDto } from './dto/preview-recurrence-rule.dto';
import { RecurrenceRuleDto } from './dto/recurrence-rule.dto';
import { UpdateRecurrenceRuleDto } from './dto/update-recurrence-rule.dto';
import { computeOccurrences } from './occurrences';
import { RecurrenceGeneratorService } from './recurrence-generator.service';

/** The rolling generation horizon (ADR-0014): recurrence generates three months ahead, no further. */
const ROLLING_HORIZON_MONTHS = 3;

/**
 * CRUD, manual generation and preview for `RecurrenceRule` (M7-T03), on top of `RecurrenceGeneratorService`
 * (M7-T02). Follows the shape `CashboxesService` set: every query `userId`-scoped, `assertOwnership`
 * for 404-on-not-yours (ADR-0006), no HTTP decisions here.
 *
 * Cross-field reference validation (account/category/subcategory ownership, active status, kind)
 * reuses `TransactionValidator` (M4-T02) so a rule and a transaction can never enforce different
 * rules for the same fields.
 */
@Injectable()
export class RecurrenceRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TransactionValidator,
    private readonly generator: RecurrenceGeneratorService,
  ) {}

  async findAll(userId: string, query: ListRecurrenceRulesQueryDto): Promise<RecurrenceRuleDto[]> {
    const rows = await this.prisma.recurrenceRule.findMany({
      where: { userId, ...this.visibility(query) },
      orderBy: [{ description: 'asc' }],
    });

    return rows.map(toDto);
  }

  async findOne(userId: string, id: string): Promise<RecurrenceRuleDto> {
    return toDto(await this.load(userId, id));
  }

  async create(userId: string, dto: CreateRecurrenceRuleDto): Promise<RecurrenceRuleDto> {
    this.assertDateRange(dto.startDate, dto.endDate ?? null);
    await this.validator.validate(userId, this.toRefInput(dto.type, dto), { requireActive: true });

    const created = await this.prisma.recurrenceRule.create({
      data: {
        userId,
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        notes: dto.notes ?? null,
        accountId: dto.accountId ?? null,
        categoryId: dto.categoryId ?? null,
        subcategoryId: dto.subcategoryId ?? null,
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        dayOfMonth: dto.dayOfMonth,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        totalOccurrences: dto.totalOccurrences ?? null,
        autoConfirm: dto.autoConfirm ?? true,
      },
    });

    return toDto(created);
  }

  async update(userId: string, id: string, dto: UpdateRecurrenceRuleDto): Promise<RecurrenceRuleDto> {
    const current = await this.load(userId, id);

    const startDate = dto.startDate ?? current.startDate;
    const endDate = dto.endDate !== undefined ? dto.endDate : current.endDate;
    this.assertDateRange(startDate, endDate);

    const type = dto.type ?? (current.type as 'INCOME' | 'EXPENSE');

    // The validator only runs when the patch actually touches a ref field or `type` — editing the
    // description of an old rule must not fail because its category (or account) was since retired
    // (ADR-0015).
    if (dto.type !== undefined || dto.accountId !== undefined || dto.categoryId !== undefined || dto.subcategoryId !== undefined) {
      const merged = this.toRefInput(type, {
        accountId: dto.accountId ?? current.accountId ?? undefined,
        categoryId: dto.categoryId ?? current.categoryId ?? undefined,
        subcategoryId: dto.subcategoryId ?? current.subcategoryId ?? undefined,
      });

      await this.validator.validate(userId, merged, { requireActive: true });
    }

    const updated = await this.prisma.recurrenceRule.update({
      where: { id },
      data: {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        notes: dto.notes,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        frequency: dto.frequency,
        interval: dto.interval,
        dayOfMonth: dto.dayOfMonth,
        startDate: dto.startDate,
        endDate: dto.endDate,
        totalOccurrences: dto.totalOccurrences,
        autoConfirm: dto.autoConfirm,
      },
    });

    return toDto(updated);
  }

  /**
   * Deactivates instead of deleting when the rule has generated transactions (ADR-0015's "deactivate,
   * don't delete", same convention `CashboxesService.remove` follows for a funded cashbox) — deleting
   * outright only when nothing points at it yet.
   */
  async remove(userId: string, id: string): Promise<RecurrenceRuleDto> {
    const current = await this.load(userId, id);

    const generatedCount = await this.prisma.transaction.count({ where: { recurrenceRuleId: id } });

    if (generatedCount > 0) {
      return toDto(await this.prisma.recurrenceRule.update({ where: { id }, data: { isActive: false } }));
    }

    await this.prisma.recurrenceRule.delete({ where: { id } });

    return toDto(current);
  }

  /** `POST /recurrence-rules/:id/generate` — delegates to `RecurrenceGeneratorService`; idempotency is entirely its concern. */
  async generate(userId: string, id: string): Promise<GenerateRecurrenceRuleResultDto> {
    const rule = await this.load(userId, id);
    const result = await this.generator.generate(userId, rule, this.rollingHorizon(ROLLING_HORIZON_MONTHS));

    return { created: result.created, generatedUntil: result.generatedUntil?.toISOString().slice(0, 10) ?? null };
  }

  /**
   * `GET /recurrence-rules/:id/preview` — the pure occurrence calculator (M7-T02), never the
   * persisting path, so nothing here opens a write transaction.
   */
  async preview(userId: string, id: string, months: number): Promise<PreviewRecurrenceRuleDto> {
    const rule = await this.load(userId, id);
    const alreadyGenerated = await this.prisma.transaction.count({ where: { recurrenceRuleId: id } });

    const occurrences = computeOccurrences(rule, this.rollingHorizon(months), alreadyGenerated);

    return { occurrences: occurrences.map((date) => date.toISOString().slice(0, 10)) };
  }

  /**
   * `POST /recurrence-rules/preview` — the same pure occurrence calculator, but for a form payload
   * that has never been persisted (#208): no `id` to load, no Prisma read at all. `generatedUntil` is
   * always `null` and `alreadyGenerated` is always `0` since an unsaved rule cannot have generated
   * anything yet.
   */
  previewPayload(dto: PreviewRecurrenceRulePayloadDto): PreviewRecurrenceRuleDto {
    this.assertDateRange(dto.startDate, dto.endDate ?? null);

    const rule = {
      frequency: dto.frequency,
      interval: dto.interval ?? 1,
      dayOfMonth: dto.dayOfMonth,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      totalOccurrences: dto.totalOccurrences ?? null,
      generatedUntil: null,
      isActive: true,
    };

    const occurrences = computeOccurrences(rule, this.rollingHorizon(dto.months ?? 12), 0);

    return { occurrences: occurrences.map((date) => date.toISOString().slice(0, 10)) };
  }

  /**
   * `POST /recurrence-rules/:id/deactivate` — the explicit, always-keep-history counterpart to
   * `remove` (#208): unlike `DELETE`, this never drops the row, so the recurrence screen (#200) can
   * call it without risking losing a rule that happens to have no generated transactions yet.
   * Idempotent: deactivating an already-inactive rule just returns it unchanged.
   */
  async deactivate(userId: string, id: string): Promise<RecurrenceRuleDto> {
    const current = await this.load(userId, id);

    if (!current.isActive) {
      return toDto(current);
    }

    return toDto(await this.prisma.recurrenceRule.update({ where: { id }, data: { isActive: false } }));
  }

  private async load(userId: string, id: string): Promise<RecurrenceRule> {
    return assertOwnership(await this.prisma.recurrenceRule.findUnique({ where: { id } }), userId);
  }

  private assertDateRange(startDate: Date, endDate: Date | null): void {
    if (endDate !== null && endDate.getTime() <= startDate.getTime()) {
      throw badRequest('RECURRENCE_END_BEFORE_START', 'endDate must be after startDate.');
    }
  }

  private toRefInput(type: 'INCOME' | 'EXPENSE', input: { accountId?: string; categoryId?: string; subcategoryId?: string }): TransactionRefInput {
    return { type, accountId: input.accountId, categoryId: input.categoryId, subcategoryId: input.subcategoryId };
  }

  /** Last day of the month that is `months` months from today, UTC. */
  private rollingHorizon(months: number): Date {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months + 1, 0));
  }

  private visibility(query: ListRecurrenceRulesQueryDto): Prisma.RecurrenceRuleWhereInput {
    if (query.includeInactive === true) {
      return {};
    }

    return { OR: query.includeId === undefined ? [{ isActive: true }] : [{ isActive: true }, { id: query.includeId }] };
  }
}

/** Prisma row → response body. `Date`s become `YYYY-MM-DD`/ISO strings, `userId` is dropped. */
function toDto(rule: RecurrenceRule): RecurrenceRuleDto {
  return {
    id: rule.id,
    type: rule.type as 'INCOME' | 'EXPENSE',
    amount: rule.amount,
    description: rule.description,
    notes: rule.notes,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    subcategoryId: rule.subcategoryId,
    frequency: rule.frequency,
    interval: rule.interval,
    dayOfMonth: rule.dayOfMonth,
    startDate: rule.startDate.toISOString().slice(0, 10),
    endDate: rule.endDate?.toISOString().slice(0, 10) ?? null,
    totalOccurrences: rule.totalOccurrences,
    autoConfirm: rule.autoConfirm,
    isActive: rule.isActive,
    generatedUntil: rule.generatedUntil?.toISOString().slice(0, 10) ?? null,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

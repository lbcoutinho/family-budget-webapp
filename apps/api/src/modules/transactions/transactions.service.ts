import { Injectable } from '@nestjs/common';

import { badRequest } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Transaction } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionDto } from './dto/transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { resolveReferenceMonthOnCreate, resolveReferenceMonthOnUpdate } from './reference-month';
import { type TransactionRefInput, TransactionValidator } from './validators/transaction-validator';

/**
 * `INCOME`/`EXPENSE` CRUD (M4-T04) — the first real consumer of `TransactionValidator` (M4-T02)
 * and the `referenceMonth` rules (M4-T03). Follows the shape `CashboxesService` set: every query
 * `userId`-scoped, `assertOwnership` for 404-on-not-yours (ADR-0006), no HTTP decisions here.
 *
 * `GET /transactions` (a list) is out of scope — #105. So is every type beyond `INCOME`/`EXPENSE`
 * — #102/#103.
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TransactionValidator,
  ) {}

  async findOne(userId: string, id: string): Promise<TransactionDto> {
    return toDto(await this.load(userId, id));
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    await this.validator.validate(userId, dto, { requireActive: true });

    const referenceMonth = resolveReferenceMonthOnCreate({ date: dto.date, referenceMonth: dto.referenceMonth });

    const created = await this.prisma.transaction.create({ data: { ...dto, userId, referenceMonth } });

    return toDto(created);
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    const current = await this.load(userId, id);

    if (dto.type !== undefined && dto.type !== current.type) {
      throw badRequest('TRANSACTION_TYPE_IMMUTABLE', 'type cannot be changed after creation.');
    }

    // The validator only runs when the patch actually touches a ref field — editing the
    // description of an old transaction must not fail because its category was since retired
    // (ADR-0015).
    if (dto.accountId !== undefined || dto.categoryId !== undefined || dto.subcategoryId !== undefined) {
      const mergedRefs: TransactionRefInput = {
        type: current.type,
        accountId: dto.accountId ?? current.accountId ?? undefined,
        categoryId: dto.categoryId ?? current.categoryId ?? undefined,
        subcategoryId: dto.subcategoryId ?? current.subcategoryId ?? undefined,
      };

      await this.validator.validate(userId, mergedRefs, { requireActive: true });
    }

    const referenceMonth = resolveReferenceMonthOnUpdate(
      { date: current.date, referenceMonth: current.referenceMonth, isCreditCard: current.isCreditCard },
      { date: dto.date, referenceMonth: dto.referenceMonth, isCreditCard: dto.isCreditCard },
    );

    const updated = await this.prisma.transaction.update({ where: { id }, data: { ...dto, referenceMonth } });

    return toDto(updated);
  }

  /** Permanent — a transaction has no history worth preserving. */
  async remove(userId: string, id: string): Promise<void> {
    await this.load(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
  }

  private async load(userId: string, id: string): Promise<Transaction> {
    return assertOwnership(await this.prisma.transaction.findUnique({ where: { id } }), userId);
  }
}

/** Prisma row → response body. `date`/`referenceMonth` become plain `YYYY-MM-DD`, `userId` is dropped. */
function toDto(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    source: transaction.source,
    amount: transaction.amount,
    date: transaction.date.toISOString().slice(0, 10),
    referenceMonth: transaction.referenceMonth.toISOString().slice(0, 10),
    description: transaction.description,
    notes: transaction.notes,
    isCreditCard: transaction.isCreditCard,
    accountId: transaction.accountId,
    destinationAccountId: transaction.destinationAccountId,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    cashboxId: transaction.cashboxId,
    destinationCashboxId: transaction.destinationCashboxId,
    cashboxLabel: transaction.cashboxLabel,
    destinationCashboxLabel: transaction.destinationCashboxLabel,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

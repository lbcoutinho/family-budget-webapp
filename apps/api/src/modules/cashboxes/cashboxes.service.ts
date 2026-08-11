import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Cashbox, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BalancesService } from '../transactions/balances.service';

import { cashboxBalances } from './cashbox-balance';
import { CashboxBalanceDto } from './dto/cashbox-balance.dto';
import { CashboxDto } from './dto/cashbox.dto';
import { CreateCashboxDto } from './dto/create-cashbox.dto';
import { ListCashboxesQueryDto } from './dto/list-cashboxes-query.dto';
import { UpdateCashboxDto } from './dto/update-cashbox.dto';

/**
 * Master data for cashboxes (M3-T05), following the shape `AccountsService` set in M3-T02: every
 * query is scoped by the `userId` off the token, a row that belongs to someone else is a 404 rather
 * than a 403 (`assertOwnership`), and nothing here decides HTTP — the controller does that.
 *
 * A duplicate name (P2002 → 409) is deliberately left to `PrismaExceptionFilter` instead of being
 * pre-empted with a read — checking first would be a race, and the database is the only place the
 * answer is authoritative. Deleting no longer relies on a foreign key: `Transaction.cashboxId` /
 * `destinationCashboxId` are `onDelete: SetNull` (M4-T01), so the zero-balance guard in `remove` is
 * the only thing standing between a funded cashbox and the drain (ADR-0019).
 */
@Injectable()
export class CashboxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
  ) {}

  /**
   * The user's cashboxes, active ones only unless asked otherwise. Ordered by `sortOrder` and then
   * by name, so the list is stable for rows sharing a position.
   */
  async findAll(userId: string, query: ListCashboxesQueryDto): Promise<CashboxDto[]> {
    const rows = await this.prisma.cashbox.findMany({
      where: { userId, ...this.visibility(query) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(toDto);
  }

  async findOne(userId: string, id: string): Promise<CashboxDto> {
    return toDto(await this.load(userId, id));
  }

  /**
   * `GET /cashboxes/balances` (M4-T07, #104). Every cashbox, active or not — same reasoning as
   * `AccountsService.findBalances`. A cashbox absent from the aggregated map (no confirmed
   * transactions yet) reports `0`.
   */
  async findBalances(userId: string, asOf?: Date): Promise<CashboxBalanceDto[]> {
    const [rows, sums] = await Promise.all([
      this.prisma.cashbox.findMany({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.balances.sumByCashbox(userId, asOf),
    ]);

    return rows.map((cashbox) => ({
      cashboxId: cashbox.id,
      name: cashbox.name,
      isActive: cashbox.isActive,
      targetAmount: cashbox.targetAmount,
      balance: sums.get(cashbox.id) ?? 0,
    }));
  }

  async create(userId: string, dto: CreateCashboxDto): Promise<CashboxDto> {
    return toDto(await this.prisma.cashbox.create({ data: { ...dto, userId } }));
  }

  async update(userId: string, id: string, dto: UpdateCashboxDto): Promise<CashboxDto> {
    await this.load(userId, id);

    return toDto(await this.prisma.cashbox.update({ where: { id }, data: dto }));
  }

  /** `PATCH /cashboxes/:id/activate` and `/deactivate`, which is how the UI's toggle is spelled. */
  async setActive(userId: string, id: string, isActive: boolean): Promise<CashboxDto> {
    await this.load(userId, id);

    return toDto(await this.prisma.cashbox.update({ where: { id }, data: { isActive } }));
  }

  /**
   * A real delete, not a soft one — deactivation is the soft path and it already exists. ADR-0019
   * narrows ADR-0015 for cashboxes: a zero balance is enough to delete even with transactions
   * pointing at it (`onDelete: SetNull` nulls `cashboxId`, and `cashboxLabel` keeps the history
   * readable). The balance is recomputed inside the transaction to close the race against a
   * concurrent write.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.load(userId, id);

    await this.prisma.$transaction(
      async (tx) => {
        const balance = (await cashboxBalances(tx, userId, [id])).get(id) ?? 0;

        if (balance !== 0) {
          throw conflict('CASHBOX_NOT_EMPTY', `Cashbox still holds ${balance} cents — empty it with a CASHBOX_OUT first.`);
        }

        await tx.cashbox.delete({ where: { id } });
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /** Read a row and prove it is the caller's, in one step. Every mutation starts here. */
  private async load(userId: string, id: string): Promise<Cashbox> {
    return assertOwnership(await this.prisma.cashbox.findUnique({ where: { id } }), userId);
  }

  /**
   * `includeInactive` opens the list up completely; `includeId` opens it for exactly one row, which
   * is what an edit form for an older transaction needs so the cashbox it already points at stays
   * selectable. The `OR` is built as an array because a branch of `{ id: undefined }` would match
   * every row rather than none.
   */
  private visibility(query: ListCashboxesQueryDto): Prisma.CashboxWhereInput {
    if (query.includeInactive === true) {
      return {};
    }

    return { OR: query.includeId === undefined ? [{ isActive: true }] : [{ isActive: true }, { id: query.includeId }] };
  }
}

/** Prisma row → response body. `Date`s become ISO strings, and `userId` is dropped on the floor. */
function toDto(cashbox: Cashbox): CashboxDto {
  return {
    id: cashbox.id,
    name: cashbox.name,
    description: cashbox.description,
    targetAmount: cashbox.targetAmount,
    isActive: cashbox.isActive,
    sortOrder: cashbox.sortOrder,
    createdAt: cashbox.createdAt.toISOString(),
    updatedAt: cashbox.updatedAt.toISOString(),
  };
}

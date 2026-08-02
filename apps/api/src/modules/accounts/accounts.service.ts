import { Injectable } from '@nestjs/common';

import { assertOwnership } from '../../common/assert-ownership';
import { type Account, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { AccountDto } from './dto/account.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * Master data for accounts (M3-T02), and the shape the other master-data services copy: every
 * query is scoped by the `userId` off the token, a row that belongs to someone else is a 404 rather
 * than a 403 (`assertOwnership`), and nothing here decides HTTP — the controller does that.
 *
 * Two Prisma errors are deliberately left to `PrismaExceptionFilter` instead of being pre-empted
 * with a read: a duplicate name (P2002 → 409) and a delete blocked by a foreign key (P2003 → 409).
 * Checking first would be a race, and the database is the only place the answer is authoritative.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The user's accounts, active ones only unless asked otherwise. Ordered by `sortOrder` and then
   * by name, so the list is stable for rows sharing a position.
   */
  async findAll(userId: string, query: ListAccountsQueryDto): Promise<AccountDto[]> {
    const rows = await this.prisma.account.findMany({
      where: { userId, ...this.visibility(query) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(toDto);
  }

  async findOne(userId: string, id: string): Promise<AccountDto> {
    return toDto(await this.load(userId, id));
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    return toDto(await this.prisma.account.create({ data: { ...dto, userId } }));
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountDto> {
    await this.load(userId, id);

    return toDto(await this.prisma.account.update({ where: { id }, data: dto }));
  }

  /** `PATCH /accounts/:id/activate` and `/deactivate`, which is how the UI's toggle is spelled. */
  async setActive(userId: string, id: string, isActive: boolean): Promise<AccountDto> {
    await this.load(userId, id);

    return toDto(await this.prisma.account.update({ where: { id }, data: { isActive } }));
  }

  /**
   * A real delete, not a soft one — deactivation is the soft path and it already exists. Once
   * transactions reference an account (M4), the foreign key refuses and the filter answers 409, so
   * the only accounts that can actually disappear are the ones nothing depends on.
   */
  async remove(userId: string, id: string): Promise<void> {
    await this.load(userId, id);
    await this.prisma.account.delete({ where: { id } });
  }

  /** Read a row and prove it is the caller's, in one step. Every mutation starts here. */
  private async load(userId: string, id: string): Promise<Account> {
    return assertOwnership(await this.prisma.account.findUnique({ where: { id } }), userId);
  }

  /**
   * `includeInactive` opens the list up completely; `includeId` opens it for exactly one row, which
   * is what an edit form for an older transaction needs so the account it already points at stays
   * selectable. The `OR` is built as an array because a branch of `{ id: undefined }` would match
   * every row rather than none.
   */
  private visibility(query: ListAccountsQueryDto): Prisma.AccountWhereInput {
    if (query.includeInactive === true) {
      return {};
    }

    return { OR: query.includeId === undefined ? [{ isActive: true }] : [{ isActive: true }, { id: query.includeId }] };
  }
}

/** Prisma row → response body. `Date`s become ISO strings, and `userId` is dropped on the floor. */
function toDto(account: Account): AccountDto {
  return {
    id: account.id,
    name: account.name,
    initialBalance: account.initialBalance,
    isActive: account.isActive,
    sortOrder: account.sortOrder,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

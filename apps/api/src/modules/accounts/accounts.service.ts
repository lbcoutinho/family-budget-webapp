import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/api-error';
import { assertOwnership } from '../../common/assert-ownership';
import { type Account, type Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BalancesService } from '../transactions/balances.service';

import { AccountBalanceDto } from './dto/account-balance.dto';
import { AccountInstrumentBalanceDto } from './dto/account-instrument-balance.dto';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: BalancesService,
  ) {}

  /**
   * The user's accounts, active ones only unless asked otherwise. Ordered by `sortOrder` and then
   * by name, so the list is stable for rows sharing a position.
   */
  async findAll(userId: string, query: ListAccountsQueryDto): Promise<AccountDto[]> {
    const rows = await this.prisma.account.findMany({
      where: { userId, ...this.visibility(query) },
      include: accountInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return rows.map(toDto);
  }

  async findOne(userId: string, id: string): Promise<AccountDto> {
    const account = await this.load(userId, id);
    return toDto(await this.prisma.account.findUniqueOrThrow({ where: { id: account.id }, include: accountInclude }));
  }

  /**
   * `GET /accounts/balances` (M4-T07, #104). Every account, active or not — a retired account can
   * still hold money, and hiding it would make the totals not add up. An account absent from the
   * aggregated map (no confirmed transactions yet) reports its `initialBalance` unchanged.
   */
  async findBalances(userId: string, asOf?: Date): Promise<AccountBalanceDto[]> {
    const [rows, sums] = await Promise.all([
      this.prisma.account.findMany({ where: { userId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.balances.sumByAccount(userId, asOf),
    ]);

    return rows.map((account) => ({
      accountId: account.id,
      name: account.name,
      isActive: account.isActive,
      initialBalance: account.initialBalance,
      balance: account.initialBalance + (sums.get(account.id) ?? 0),
    }));
  }

  async findInstrumentBalances(userId: string, asOf?: Date): Promise<AccountInstrumentBalanceDto[]> {
    return (await this.balances.instrumentBalances(userId, asOf)).map((balance) => ({ ...balance, quantity: balance.quantity.toString() }));
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    await this.assertReferences(userId, dto.financialInstitutionId, dto.initialBalances);
    const { initialBalances, ...data } = dto;
    const balances = await this.withLegacyEur(userId, dto.initialBalance, initialBalances ?? []);
    this.assertUniqueInstruments(balances);

    return toDto(
      await this.prisma.account.create({
        data: { ...data, userId, initialBalances: { create: balances.map((balance) => ({ ...balance, userId })) } },
        include: accountInclude,
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountDto> {
    await this.load(userId, id);
    await this.assertReferences(userId, dto.financialInstitutionId, dto.initialBalances);
    const { initialBalances, ...data } = dto;
    if (initialBalances !== undefined) this.assertUniqueInstruments(initialBalances);

    return toDto(
      await this.prisma.$transaction(async (tx) => {
        if (initialBalances !== undefined) {
          await tx.accountInitialBalance.deleteMany({ where: { accountId: id } });
        }
        const balances = await this.withLegacyEur(userId, dto.initialBalance, initialBalances ?? [], tx);
        if (initialBalances === undefined && dto.initialBalance !== undefined) {
          const instrumentId = balances[0]!.instrumentId;
          await tx.accountInitialBalance.upsert({
            where: { accountId_instrumentId: { accountId: id, instrumentId } },
            create: { userId, accountId: id, instrumentId, quantity: centsToQuantity(dto.initialBalance) },
            update: { quantity: centsToQuantity(dto.initialBalance) },
          });
        }
        return tx.account.update({
          where: { id },
          data: {
            ...data,
            ...(initialBalances === undefined ? {} : { initialBalances: { create: balances.map((balance) => ({ ...balance, userId })) } }),
          },
          include: accountInclude,
        });
      }),
    );
  }

  /** `PATCH /accounts/:id/activate` and `/deactivate`, which is how the UI's toggle is spelled. */
  async setActive(userId: string, id: string, isActive: boolean): Promise<AccountDto> {
    const account = await this.load(userId, id);

    if (!isActive) {
      const balance = account.initialBalance + ((await this.balances.sumByAccount(userId)).get(id) ?? 0);
      if (balance !== 0) {
        throw conflict('ACCOUNT_NOT_EMPTY', `Account still holds ${balance} cents — zero it before deactivating.`, { balance });
      }
    }

    return toDto(await this.prisma.account.update({ where: { id }, data: { isActive }, include: accountInclude }));
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

  private async assertReferences(
    userId: string,
    financialInstitutionId: string | null | undefined,
    balances: CreateAccountDto['initialBalances'],
  ): Promise<void> {
    if (financialInstitutionId !== undefined && financialInstitutionId !== null) {
      const institution = await this.prisma.financialInstitution.findFirst({ where: { id: financialInstitutionId, userId, isActive: true } });
      if (!institution) throw conflict('INVESTMENT_REFERENCE_INACTIVE', 'An active financial institution is required.');
    }
    if (balances?.length) {
      const count = await this.prisma.instrument.count({ where: { userId, isActive: true, id: { in: balances.map((balance) => balance.instrumentId) } } });
      if (count !== new Set(balances.map((balance) => balance.instrumentId)).size) {
        throw conflict('INVESTMENT_REFERENCE_INACTIVE', 'An active instrument is required.');
      }
    }
  }

  private assertUniqueInstruments(balances: readonly { instrumentId: string }[]): void {
    if (new Set(balances.map((balance) => balance.instrumentId)).size !== balances.length) {
      throw conflict('ACCOUNT_INITIAL_BALANCE_DUPLICATE', 'An account has at most one initial balance per instrument.');
    }
  }

  private async eurInstrument(userId: string, client: Pick<PrismaService, 'instrument'> = this.prisma): Promise<string> {
    const existing = await client.instrument.findFirst({ where: { userId, code: 'EUR' } });
    if (existing) return existing.id;
    return (await client.instrument.create({ data: { userId, name: 'Euro', code: 'EUR', type: 'FIAT' } })).id;
  }

  private async withLegacyEur(
    userId: string,
    initialBalance: number | undefined,
    balances: NonNullable<CreateAccountDto['initialBalances']>,
    client: Pick<PrismaService, 'instrument'> = this.prisma,
  ): Promise<NonNullable<CreateAccountDto['initialBalances']>> {
    if (initialBalance === undefined) return balances;
    const instrumentId = await this.eurInstrument(userId, client);
    const quantity = centsToQuantity(initialBalance);
    const existing = balances.findIndex((balance) => balance.instrumentId === instrumentId);
    return existing < 0
      ? [...balances, { instrumentId, quantity }]
      : balances.map((balance, index) => (index === existing ? { ...balance, quantity } : balance));
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
const accountInclude = {
  financialInstitution: { select: { name: true } },
  initialBalances: { include: { instrument: { select: { code: true, name: true } } }, orderBy: { instrument: { code: 'asc' } } },
} as const;
type AccountRow = Prisma.AccountGetPayload<{ include: typeof accountInclude }>;

function toDto(account: AccountRow): AccountDto {
  return {
    id: account.id,
    name: account.name,
    kind: account.kind,
    financialInstitutionId: account.financialInstitutionId,
    financialInstitutionName: account.financialInstitution?.name ?? null,
    initialBalances: account.initialBalances.map((balance) => ({
      instrumentId: balance.instrumentId,
      quantity: balance.quantity.toString(),
      instrumentName: balance.instrument.name,
      instrumentCode: balance.instrument.code,
    })),
    initialBalance: account.initialBalance,
    isActive: account.isActive,
    sortOrder: account.sortOrder,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function centsToQuantity(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const value = String(Math.abs(cents));
  return `${sign}${value.slice(0, -2) || '0'}.${value.slice(-2).padStart(2, '0')}`;
}

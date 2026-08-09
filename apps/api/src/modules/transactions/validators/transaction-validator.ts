import { Injectable } from '@nestjs/common';

import { badRequest, notFound } from '../../../common/api-error';
import { type Account, type Cashbox, type Category, type CategoryKind, type TransactionType } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/** Every foreign key a transaction can carry. Order here is the order queries run in. */
export const TRANSACTION_REF_FIELDS = ['accountId', 'destinationAccountId', 'cashboxId', 'destinationCashboxId', 'categoryId', 'subcategoryId'] as const;
export type TransactionRefField = (typeof TRANSACTION_REF_FIELDS)[number];

/** Structural input the validator needs — a DTO satisfies it without the validator importing one. */
export type TransactionRefInput = { type: TransactionType } & Partial<Record<TransactionRefField, string>>;

/** Options controlling whether resolved rows must be active (ADR-0015). */
export interface TransactionValidatorOptions {
  requireActive: boolean;
}

/** The rows resolved while validating, handed back so callers don't re-read them (ADR-0019). */
export interface ResolvedTransactionRefs {
  account: Account | null;
  destinationAccount: Account | null;
  cashbox: Cashbox | null;
  destinationCashbox: Cashbox | null;
  category: Category | null;
  subcategory: Category | null;
}

/**
 * Which ref fields each `TransactionType` requires. Forbidden is everything else in
 * `TRANSACTION_REF_FIELDS` — computed, not hand-written, so the two halves cannot drift apart.
 *
 * `CASHBOX_IN`/`CASHBOX_OUT` both take `accountId` + `cashboxId`: direction is carried by the type,
 * not by which column is filled.
 */
const REQUIRED_FIELDS: Record<TransactionType, readonly TransactionRefField[]> = {
  INCOME: ['accountId', 'categoryId', 'subcategoryId'],
  EXPENSE: ['accountId', 'categoryId', 'subcategoryId'],
  TRANSFER: ['accountId', 'destinationAccountId'],
  CASHBOX_IN: ['accountId', 'cashboxId'],
  CASHBOX_OUT: ['accountId', 'cashboxId'],
  CASHBOX_TRANSFER: ['cashboxId', 'destinationCashboxId'],
};

/** Which `CategoryKind` the type demands. A type absent here takes no category at all. */
const REQUIRED_CATEGORY_KIND: Partial<Record<TransactionType, CategoryKind>> = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
};

type Entity = Account | Cashbox | Category;

/**
 * The one place the six transaction-type invariants live (M4-T02), because the schema cannot
 * express them: which ref fields a type takes, that they belong to the caller, that they are
 * active, and that a category/subcategory pairing makes sense. Consumed by both create and update
 * (M4-T03) so the two paths cannot enforce different rules.
 *
 * Deliberately not a DTO validator: `input` is a narrow structural type, so it serves both without
 * either importing the other.
 */
@Injectable()
export class TransactionValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validate(userId: string, input: TransactionRefInput, opts: TransactionValidatorOptions): Promise<ResolvedTransactionRefs> {
    this.assertShape(input);
    this.assertDistinct(input);

    const refs = await this.load(userId, input);

    if (opts.requireActive) {
      this.assertActive(refs);
    }

    this.assertCategoryKind(input.type, refs.category);
    this.assertSubcategoryParent(input, refs.subcategory);

    return refs;
  }

  /** Every required field present, every other ref field absent. */
  private assertShape(input: TransactionRefInput): void {
    const required = REQUIRED_FIELDS[input.type];

    for (const field of TRANSACTION_REF_FIELDS) {
      const present = input[field] !== undefined && input[field] !== null;
      const isRequired = required.includes(field);

      if (isRequired && !present) {
        throw badRequest('TRANSACTION_FIELD_REQUIRED', `${field} is required for ${input.type}.`);
      }

      if (!isRequired && present) {
        throw badRequest('TRANSACTION_FIELD_NOT_ALLOWED', `${field} is not allowed for ${input.type}.`);
      }
    }
  }

  /** A self-reference is a shape error, checked before anything is loaded. */
  private assertDistinct(input: TransactionRefInput): void {
    if (input.accountId !== undefined && input.accountId === input.destinationAccountId) {
      throw badRequest('TRANSACTION_SAME_ACCOUNT', 'destinationAccountId must differ from accountId.');
    }

    if (input.cashboxId !== undefined && input.cashboxId === input.destinationCashboxId) {
      throw badRequest('TRANSACTION_SAME_CASHBOX', 'destinationCashboxId must differ from cashboxId.');
    }
  }

  /** One `findMany` per entity type — at most three queries, regardless of the transaction type. */
  private async load(userId: string, input: TransactionRefInput): Promise<ResolvedTransactionRefs> {
    const accountIds = [input.accountId, input.destinationAccountId].filter((id): id is string => id !== undefined);
    const cashboxIds = [input.cashboxId, input.destinationCashboxId].filter((id): id is string => id !== undefined);
    const categoryIds = [input.categoryId, input.subcategoryId].filter((id): id is string => id !== undefined);

    const [accounts, cashboxes, categories] = await Promise.all([
      accountIds.length === 0 ? Promise.resolve([]) : this.prisma.account.findMany({ where: { userId, id: { in: accountIds } } }),
      cashboxIds.length === 0 ? Promise.resolve([]) : this.prisma.cashbox.findMany({ where: { userId, id: { in: cashboxIds } } }),
      categoryIds.length === 0 ? Promise.resolve([]) : this.prisma.category.findMany({ where: { userId, id: { in: categoryIds } } }),
    ]);

    return {
      account: this.resolve(input.accountId, accounts),
      destinationAccount: this.resolve(input.destinationAccountId, accounts),
      cashbox: this.resolve(input.cashboxId, cashboxes),
      destinationCashbox: this.resolve(input.destinationCashboxId, cashboxes),
      category: this.resolve(input.categoryId, categories),
      subcategory: this.resolve(input.subcategoryId, categories),
    };
  }

  /**
   * A missing id is a 404, indistinguishable from one that belongs to another user (ADR-0006) — the
   * same contract `assertOwnership` makes for single-entity lookups.
   */
  private resolve<T extends Entity>(id: string | undefined, rows: T[]): T | null {
    if (id === undefined) {
      return null;
    }

    const row = rows.find((candidate) => candidate.id === id);

    if (row === undefined) {
      throw notFound('RECORD_NOT_FOUND', 'The requested record was not found.');
    }

    return row;
  }

  private assertActive(refs: ResolvedTransactionRefs): void {
    const rows: (Entity | null)[] = [refs.account, refs.destinationAccount, refs.cashbox, refs.destinationCashbox, refs.category, refs.subcategory];

    for (const row of rows) {
      if (row !== null && row.isActive === false) {
        throw badRequest('TRANSACTION_REFERENCE_INACTIVE', 'A referenced account, category, subcategory or cashbox is deactivated.');
      }
    }
  }

  private assertCategoryKind(type: TransactionType, category: Category | null): void {
    const requiredKind = REQUIRED_CATEGORY_KIND[type];

    if (requiredKind !== undefined && category?.kind !== requiredKind) {
      throw badRequest('TRANSACTION_CATEGORY_KIND_MISMATCH', `categoryId must reference a ${requiredKind} category for ${type}.`);
    }
  }

  private assertSubcategoryParent(input: TransactionRefInput, subcategory: Category | null): void {
    if (subcategory !== null && subcategory.parentId !== input.categoryId) {
      throw badRequest('TRANSACTION_SUBCATEGORY_PARENT_MISMATCH', 'subcategoryId must be a child of categoryId.');
    }
  }
}

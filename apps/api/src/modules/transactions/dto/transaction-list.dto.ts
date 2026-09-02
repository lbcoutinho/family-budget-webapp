import { ApiProperty } from '@nestjs/swagger';

import { TransactionDto } from './transaction.dto';

class ListRelationRefDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

class ListCategoryRefDto extends ListRelationRefDto {
  @ApiProperty({ type: String, nullable: true })
  color!: string | null;
}

/**
 * A row of `GET /api/transactions` (M4-T08). `destinationAccount`/`destinationCashbox` are
 * deliberately not expanded — the id plus `destinationCashboxLabel` is what a list row needs;
 * `cashbox` likewise stays collapsed since `cashboxLabel` is already the ADR-0019 snapshot.
 */
export class TransactionListItemDto extends TransactionDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 110_000,
    description:
      'Source account balance in cents after this confirmed transaction in the complete chronological ledger. Null for drafts and cashbox transfers.',
  })
  accountBalanceAfter!: number | null;

  @ApiProperty({ type: ListRelationRefDto, nullable: true })
  account!: ListRelationRefDto | null;

  @ApiProperty({ type: ListCategoryRefDto, nullable: true })
  category!: ListCategoryRefDto | null;

  @ApiProperty({ type: ListCategoryRefDto, nullable: true })
  subcategory!: ListCategoryRefDto | null;
}

export class TransactionListDto {
  @ApiProperty({ type: TransactionListItemDto, isArray: true })
  items!: TransactionListItemDto[];

  @ApiProperty({ type: Number, description: 'Rows matching the filters, ignoring `limit`/`cursor`.' })
  total!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of INCOME over the filtered set.' })
  incomeTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of EXPENSE only — the domain rule that only EXPENSE is an expense.' })
  expenseTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of CASHBOX_IN over the filtered set.' })
  cashboxInTotal!: number;

  @ApiProperty({ type: Number, description: 'Cents, sum of CASHBOX_OUT over the filtered set.' })
  cashboxOutTotal!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Pass as `cursor` to fetch the next page. `null` on the last page.' })
  nextCursor!: string | null;
}

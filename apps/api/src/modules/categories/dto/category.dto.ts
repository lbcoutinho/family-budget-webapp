import { ApiProperty } from '@nestjs/swagger';

import { CategoryKind } from '../../../generated/prisma/client';

/**
 * A category as the API hands it out — the same shape at both levels of the tree, so a client has
 * one type to hold. `userId` is the tenancy boundary and never leaves the server (see `AccountDto`
 * for the reasoning).
 *
 * `children` is the whole of `?tree=true`: the flat list leaves it undefined, the tree fills it in
 * on roots. One response type rather than two, because a union response would reach the generated
 * client as an either-or the caller has to narrow at every call site.
 *
 * Every `@ApiProperty` states its `type` explicitly — the OpenAPI export runs under `tsx`, which
 * emits no `design:type` metadata, so a bare `@ApiProperty()` breaks `pnpm gen`.
 */
export class CategoryDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '`null` on a root category. A subcategory always points at a root.' })
  parentId!: string | null;

  @ApiProperty({ type: String, example: 'Alimentação' })
  name!: string;

  @ApiProperty({ enum: CategoryKind, enumName: 'CategoryKind', example: CategoryKind.EXPENSE, description: 'A subcategory always matches its parent.' })
  kind!: CategoryKind;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '#a85c1a',
    description: '`#RRGGBB`, and set on roots only — subcategories inherit their parent’s colour in the charts. Null is a normal state.',
  })
  color!: string | null;

  @ApiProperty({ type: Boolean, example: true, description: 'Inactive categories stay readable in history but are kept out of the pickers.' })
  isActive!: boolean;

  @ApiProperty({ type: Number, example: 0, description: "Position in the user's own ordering, within its own level. Ties are broken by name." })
  sortOrder!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({
    type: () => [CategoryDto],
    required: false,
    description: 'Subcategories, on roots and only for `?tree=true`. Absent from the flat list, and never present on a subcategory.',
  })
  children?: CategoryDto[];
}

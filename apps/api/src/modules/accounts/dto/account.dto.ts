import { ApiProperty } from '@nestjs/swagger';

/**
 * An account as the API hands it out. Deliberately not the Prisma row: `userId` is the tenancy
 * boundary, not information a client needs, and a column added to the model later cannot leak into
 * a response through a type that has no field for it.
 *
 * Every `@ApiProperty` states its `type` explicitly — the OpenAPI export runs under `tsx`, which
 * emits no `design:type` metadata, so a bare `@ApiProperty()` breaks `pnpm gen`.
 */
export class AccountDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  id!: string;

  @ApiProperty({ type: String, example: 'Millennium' })
  name!: string;

  @ApiProperty({ type: Number, example: 150000, description: 'Balance before the first recorded transaction, in **cents** (ADR-0005). May be negative.' })
  initialBalance!: number;

  @ApiProperty({ type: Boolean, example: true, description: 'Inactive accounts stay readable in history but are kept out of the pickers.' })
  isActive!: boolean;

  @ApiProperty({ type: Number, example: 0, description: "Position in the user's own ordering. Ties are broken by name." })
  sortOrder!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

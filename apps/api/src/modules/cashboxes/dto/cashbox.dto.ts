import { ApiProperty } from '@nestjs/swagger';

/**
 * A cashbox as the API hands it out. Deliberately not the Prisma row: `userId` is the tenancy
 * boundary, not information a client needs.
 *
 * There is no `balance` here. It is the sum of the confirmed cashbox movements and arrives with
 * M4-T07; the screen (M3-T09) shows a placeholder until then.
 *
 * Every `@ApiProperty` states its `type` explicitly — the OpenAPI export runs under `tsx`, which
 * emits no `design:type` metadata, so a bare `@ApiProperty()` breaks `pnpm gen`.
 */
export class CashboxDto {
  @ApiProperty({ type: String, format: 'uuid', example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  id!: string;

  @ApiProperty({ type: String, example: 'Fundo de emergência' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Seis meses de despesas fixas.' })
  description!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 500_000,
    description: 'Goal to draw progress against, in **cents** (ADR-0005). Null means the cashbox simply accumulates.',
  })
  targetAmount!: number | null;

  @ApiProperty({ type: Boolean, example: true, description: 'Inactive cashboxes stay readable in history but are kept out of the pickers.' })
  isActive!: boolean;

  @ApiProperty({ type: Number, example: 0, description: "Position in the user's own ordering. Ties are broken by name." })
  sortOrder!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

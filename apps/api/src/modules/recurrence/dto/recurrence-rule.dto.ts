import { ApiProperty } from '@nestjs/swagger';

/**
 * A recurrence rule as the API hands it out. Deliberately not the Prisma row: `userId` is the
 * tenancy boundary, not information a client needs.
 *
 * Every `@ApiProperty` states its `type` explicitly — the OpenAPI export runs under `tsx`, which
 * emits no `design:type` metadata, so a bare `@ApiProperty()` breaks `pnpm gen`.
 */
export class RecurrenceRuleDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, enum: ['INCOME', 'EXPENSE'], enumName: 'RecurrenceRuleType' })
  type!: 'INCOME' | 'EXPENSE';

  @ApiProperty({ type: Number, example: 1_000, description: 'Always positive, in **cents** (ADR-0005).' })
  amount!: number;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  accountId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  categoryId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  subcategoryId!: string | null;

  @ApiProperty({ type: String, enum: ['MONTHLY', 'YEARLY'], enumName: 'RecurrenceFrequency' })
  frequency!: 'MONTHLY' | 'YEARLY';

  @ApiProperty({ type: Number })
  interval!: number;

  @ApiProperty({ type: Number, example: 15 })
  dayOfMonth!: number;

  @ApiProperty({ type: String, format: 'date' })
  startDate!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  endDate!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Lifetime cap on generated occurrences. Null means open-ended (ADR-0014).' })
  totalOccurrences!: number | null;

  @ApiProperty({ type: Boolean })
  autoConfirm!: boolean;

  @ApiProperty({ type: Boolean, description: 'Deactivated rules are kept for history but never generate again.' })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'Rolling generation horizon watermark. Null means never generated.' })
  generatedUntil!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

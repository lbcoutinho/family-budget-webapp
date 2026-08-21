import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { toDateOnly } from '../../transactions/dto/date-only.transform';

/**
 * Request body of `POST /api/recurrence-rules/preview` — the scheduling subset of
 * `CreateRecurrenceRuleDto`, for an unsaved form (#208). Same validation as rule creation for the
 * fields the pure occurrence calculator actually reads; every non-scheduling field (amount,
 * description, account/category refs, ...) is irrelevant to occurrence dates and left out.
 */
export class PreviewRecurrenceRulePayloadDto {
  @ApiProperty({ type: String, enum: ['MONTHLY', 'YEARLY'], enumName: 'RecurrenceFrequency' })
  @IsIn(['MONTHLY', 'YEARLY'])
  frequency!: 'MONTHLY' | 'YEARLY';

  @ApiProperty({ type: Number, required: false, default: 1, description: 'Every N months/years, per `frequency`.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  interval?: number;

  @ApiProperty({ type: Number, example: 15, description: '1–31; a day that does not exist in the target month falls back to that month’s last day.' })
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth!: number;

  @ApiProperty({ type: String, format: 'date', example: '2026-03-01', description: 'First possible occurrence, `YYYY-MM-DD`.' })
  @Transform(toDateOnly)
  @IsDate({ message: 'startDate must be in the form YYYY-MM-DD.' })
  startDate!: Date;

  @ApiProperty({
    type: String,
    format: 'date',
    required: false,
    nullable: true,
    example: '2027-03-01',
    description: 'Last possible occurrence, `YYYY-MM-DD`. Null means open-ended.',
  })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'endDate must be in the form YYYY-MM-DD.' })
  endDate?: Date | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    example: 12,
    description: 'Lifetime cap on generated occurrences — installments. Null or omitted means open-ended recurrence (ADR-0014).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalOccurrences?: number | null;

  @ApiProperty({ type: Number, required: false, default: 12, minimum: 1, maximum: 24, description: 'How many months ahead to preview.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

import { ApiProperty } from '@nestjs/swagger';

/** Response body of `GET /api/recurrence-rules/:id/preview` — nothing here was persisted. */
export class PreviewRecurrenceRuleDto {
  @ApiProperty({ type: [String], format: 'date', description: 'Upcoming occurrence dates, `YYYY-MM-DD`, oldest first.' })
  occurrences!: string[];
}

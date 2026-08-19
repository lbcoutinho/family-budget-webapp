import { ApiProperty } from '@nestjs/swagger';

/** Response body of `POST /api/recurrence-rules/:id/generate`. */
export class GenerateRecurrenceRuleResultDto {
  @ApiProperty({ type: Number, description: 'Transactions created by this call. `0` when the rule was already generated up to the horizon.' })
  created!: number;

  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'The rolling generation horizon watermark after this call.' })
  generatedUntil!: string | null;
}

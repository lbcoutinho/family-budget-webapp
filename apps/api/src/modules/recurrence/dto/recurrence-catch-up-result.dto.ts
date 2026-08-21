import { ApiProperty } from '@nestjs/swagger';

import { RecurrenceCatchUpFailureDto } from './recurrence-catch-up-failure.dto';

/** Response body of `POST /api/recurrence-rules/catch-up`. */
export class RecurrenceCatchUpResultDto {
  @ApiProperty({ type: Number, description: "Candidate rules the run attempted, for the caller's own user." })
  rulesProcessed!: number;

  @ApiProperty({ type: Number, description: 'Transactions created across every rule in this run.' })
  created!: number;

  @ApiProperty({ type: [RecurrenceCatchUpFailureDto], description: 'Rules that threw during generation; the run continued past them.' })
  failed!: RecurrenceCatchUpFailureDto[];

  @ApiProperty({
    type: Boolean,
    description: 'True when another run for this user was already in progress; this run generated nothing.',
  })
  skippedLocked!: boolean;
}

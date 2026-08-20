import { ApiProperty } from '@nestjs/swagger';

/** One rule that threw during a catch-up run; the run continues past it. */
export class RecurrenceCatchUpFailureDto {
  @ApiProperty({ type: String, format: 'uuid' })
  ruleId!: string;

  @ApiProperty({ type: String })
  message!: string;
}

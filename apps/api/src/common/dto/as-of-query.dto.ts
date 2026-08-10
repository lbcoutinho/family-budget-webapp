import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Same shape as `toDateOnly` in `CreateTransactionDto`: a string that fails the format check
// passes through unconverted, so `@IsDate` is what actually rejects it with a 400. The explicit
// `Z` matters because the column is `@db.Date`, and parsing without it would shift the day on a
// negative-offset host.
const toDateOnly = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000Z`) : value;

/** Shared `?asOf=YYYY-MM-DD` query param for the balance endpoints (M4-T07, #104). */
export class AsOfQueryDto {
  @ApiProperty({
    type: String,
    required: false,
    example: '2026-08-31',
    description: 'Balance as of the end of this day. Omitted = every confirmed transaction.',
  })
  @IsOptional()
  @Transform(toDateOnly)
  @IsDate({ message: 'asOf must be in the form YYYY-MM-DD.' })
  asOf?: Date;
}

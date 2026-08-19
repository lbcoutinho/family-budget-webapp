import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/** Query string of `GET /api/recurrence-rules`. */
export class ListRecurrenceRulesQueryDto {
  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description: 'Include deactivated rules. Off by default, so a picker never offers a retired rule.',
  })
  // The query string carries `?includeInactive=true`, never a boolean, and `ValidationPipe`'s
  // `transform` coerces any non-empty string to `true` — `?includeInactive=false` included. The
  // string is compared explicitly here, before `@IsBoolean()` sees it.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    required: false,
    description: 'Return this rule even if inactive, alongside the active ones — what an edit form for an older rule needs.',
  })
  @IsOptional()
  @IsUUID()
  includeId?: string;
}

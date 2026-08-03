import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/** Query string of `GET /api/accounts`. */
export class ListAccountsQueryDto {
  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description: 'Include deactivated accounts. Off by default, so a picker never offers a retired account.',
  })
  // A query string carries `?includeInactive=true`, never a boolean, and `ValidationPipe`'s
  // `transform` coerces any non-empty string to `true` — `?includeInactive=false` included. So the
  // string is compared explicitly here, before `@IsBoolean()` sees it.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase() === 'true' : value))
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    required: false,
    description:
      'Return this account even if it is inactive, alongside the active ones. What an edit form for an older transaction needs, so the account it already points at is still selectable.',
  })
  @IsOptional()
  @IsUUID()
  includeId?: string;
}

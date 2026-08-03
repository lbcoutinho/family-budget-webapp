import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

/**
 * Query string of `GET /api/categories`.
 *
 * A query string carries `?tree=true`, never a boolean, and `ValidationPipe`'s `transform` coerces
 * any non-empty string to `true` — `?tree=false` included. So each flag is compared as a string
 * here, before `@IsBoolean()` sees it.
 */
const toBoolean = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.toLowerCase() === 'true' : value);

export class ListCategoriesQueryDto {
  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description: 'Nest subcategories under their root in `children` instead of returning one flat list.',
  })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  tree?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description: 'Include deactivated categories. Off by default, so a picker never offers a retired one.',
  })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    required: false,
    description:
      'Return this category even if it is inactive, alongside the active ones. What an edit form for an older transaction needs, so the category it already points at is still selectable.',
  })
  @IsOptional()
  @IsUUID()
  includeId?: string;
}

import { PartialType } from '@nestjs/swagger';

import { CreateCategoryDto } from './create-category.dto';

/**
 * Request body of `PATCH /api/categories/:id`. `PartialType` from `@nestjs/swagger` (not from
 * `@nestjs/mapped-types`) so the `@ApiProperty` metadata survives into the OpenAPI document.
 *
 * `isActive` is reachable here as well as through `/activate` and `/deactivate`, but only the
 * dedicated routes run the cascade and the last-subcategory check — see `CategoriesService`.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

import { PartialType } from '@nestjs/swagger';

import { CreateCashboxDto } from './create-cashbox.dto';

/**
 * Request body of `PATCH /api/cashboxes/:id` — every field of the create body, all optional.
 * `PartialType` from `@nestjs/swagger` (not `@nestjs/mapped-types`) carries the `@ApiProperty`
 * metadata across, so the endpoint documents itself.
 *
 * `isActive` is writable here as well as through `/activate` and `/deactivate`; those two exist so
 * the UI's toggle is one unambiguous call rather than a partial update that happens to flip a flag.
 */
export class UpdateCashboxDto extends PartialType(CreateCashboxDto) {}

import { PartialType } from '@nestjs/swagger';

import { CreatePositionAdjustmentDto } from './create-position-adjustment.dto';

export class UpdatePositionAdjustmentDto extends PartialType(CreatePositionAdjustmentDto) {}

import { PartialType } from '@nestjs/swagger';

import { CreateBalanceAdjustmentDto } from './create-balance-adjustment.dto';

export class UpdateBalanceAdjustmentDto extends PartialType(CreateBalanceAdjustmentDto) {}

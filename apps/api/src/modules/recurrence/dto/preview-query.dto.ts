import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query string of `GET /api/recurrence-rules/:id/preview`. */
export class PreviewQueryDto {
  @ApiProperty({ type: Number, required: false, default: 12, minimum: 1, maximum: 24, description: 'How many months ahead to preview.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months = 12;
}

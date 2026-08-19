import { ApiProperty } from '@nestjs/swagger';

/** Response body of `POST /api/recurrence-rules/:id/cancel-installments`. */
export class CancelInstallmentPlanResultDto {
  @ApiProperty({ type: Number, description: 'Future, non-CONFIRMED installments removed. Confirmed and past rows are never touched.' })
  deleted!: number;
}

import { ApiProperty } from '@nestjs/swagger';

/** Response body of `POST /api/recurrence-rules/:id/cancel-installments`. */
export class CancelInstallmentPlanResultDto {
  @ApiProperty({ type: Number, description: 'Installments dated after today removed. Today and past rows are never touched.' })
  deleted!: number;
}

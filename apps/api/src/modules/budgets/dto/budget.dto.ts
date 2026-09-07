import { ApiProperty } from '@nestjs/swagger';

export class BudgetDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number })
  year!: number;

  @ApiProperty({ type: Number })
  quarter!: number;

  @ApiProperty({ type: Number, description: 'Estimated quarterly Income in integer cents.' })
  estimatedQuarterlyIncome!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

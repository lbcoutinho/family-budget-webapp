import { ApiProperty } from '@nestjs/swagger';

import { BudgetAllocationDto } from './budget-allocation.dto';

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

  @ApiProperty({ type: () => [BudgetAllocationDto] })
  allocations!: BudgetAllocationDto[];

  @ApiProperty({ type: Number, description: 'Sum of effective quarterly Expense targets in integer cents.' })
  effectiveQuarterlyExpenseTotal!: number;

  @ApiProperty({ type: Number, description: 'Estimated Income less effective quarterly Expense targets, in integer cents.' })
  plannedFinancialGoalsAvailability!: number;

  @ApiProperty({ type: Number, multipleOf: 0.01 })
  effectiveExpensePercentage!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

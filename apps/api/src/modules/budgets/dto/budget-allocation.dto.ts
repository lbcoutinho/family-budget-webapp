import { ApiProperty } from '@nestjs/swagger';

export class BudgetAllocationCategoryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  color!: string | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;
}

export class BudgetAllocationDto {
  @ApiProperty({ type: String, format: 'uuid' })
  categoryId!: string;

  @ApiProperty({ type: () => BudgetAllocationCategoryDto })
  category!: BudgetAllocationCategoryDto;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100, multipleOf: 0.01 })
  targetPercentage!: number;

  @ApiProperty({ type: Number, description: 'Suggested quarterly target in integer cents.' })
  suggestedQuarterlyTarget!: number;

  @ApiProperty({ type: Number, description: 'Suggested monthly target in integer cents.' })
  suggestedMonthlyTarget!: number;

  @ApiProperty({ type: Number, description: 'Effective monthly target in integer cents.' })
  adjustedMonthlyAmount!: number;

  @ApiProperty({ type: Number, description: 'Effective quarterly target in integer cents.' })
  effectiveQuarterlyTarget!: number;

  @ApiProperty({ type: Number, minimum: 0, multipleOf: 0.01 })
  effectivePercentage!: number;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;
}

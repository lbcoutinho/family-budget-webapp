import { Injectable } from '@nestjs/common';

import { badRequest } from '../../common/api-error';
import { type Budget, type BudgetAllocation, CategoryKind, type Category } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { type BudgetAllocationDto } from './dto/budget-allocation.dto';
import { BudgetDto } from './dto/budget.dto';
import { type PutBudgetAllocationDto } from './dto/put-budget-allocation.dto';
import { PutBudgetDto } from './dto/put-budget.dto';

type BudgetWithAllocations = Budget & { allocations: (BudgetAllocation & { category: Category })[] };

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string, year: number, quarter: number): Promise<BudgetDto | null> {
    const budget = await this.prisma.budget.findUnique({ where: { userId_year_quarter: { userId, year, quarter } }, include: allocationInclude });
    return budget && toDto(budget);
  }

  async put(userId: string, year: number, quarter: number, dto: PutBudgetDto): Promise<BudgetDto> {
    const allocations = dto.allocations ?? [];
    this.assertUniqueCategories(allocations);
    await this.assertAllocatableCategories(userId, allocations);

    const budget = await this.prisma.$transaction(async (tx) => {
      const { allocations: _allocations, ...budgetData } = dto;
      const saved = await tx.budget.upsert({
        where: { userId_year_quarter: { userId, year, quarter } },
        create: { userId, year, quarter, ...budgetData },
        update: budgetData,
      });
      const persisted = allocations.filter((allocation) => allocation.targetPercentage > 0 || allocation.adjustedMonthlyAmount > 0 || allocation.note);

      await tx.budgetAllocation.deleteMany({ where: { budgetId: saved.id } });
      if (persisted.length > 0) {
        await tx.budgetAllocation.createMany({
          data: persisted.map((allocation) => ({
            budgetId: saved.id,
            categoryId: allocation.categoryId,
            targetPercentageBasis: Math.round(allocation.targetPercentage * 100),
            adjustedMonthlyAmount: allocation.adjustedMonthlyAmount,
            note: allocation.note ?? null,
          })),
        });
      }

      return tx.budget.findUniqueOrThrow({ where: { id: saved.id }, include: allocationInclude });
    });
    return toDto(budget);
  }

  private assertUniqueCategories(allocations: PutBudgetAllocationDto[]): void {
    if (new Set(allocations.map((allocation) => allocation.categoryId)).size !== allocations.length) {
      throw badRequest('BUDGET_ALLOCATION_CATEGORY_DUPLICATE', 'A Budget can only allocate a Category once.');
    }
  }

  private async assertAllocatableCategories(userId: string, allocations: PutBudgetAllocationDto[]): Promise<void> {
    if (allocations.length === 0) return;

    const categories = await this.prisma.category.count({
      where: { id: { in: allocations.map((allocation) => allocation.categoryId) }, userId, parentId: null, kind: CategoryKind.EXPENSE, isActive: true },
    });
    if (categories !== allocations.length) {
      throw badRequest('BUDGET_ALLOCATION_CATEGORY_INVALID', 'Budget allocations must reference the user’s active top-level Expense Categories.');
    }
  }
}

const allocationInclude = { allocations: { include: { category: true } } } as const;

function toDto(budget: BudgetWithAllocations): BudgetDto {
  const allocations = budget.allocations.map((allocation) => toAllocationDto(allocation, budget.estimatedQuarterlyIncome));
  const effectiveQuarterlyExpenseTotal = allocations.reduce((total, allocation) => total + allocation.effectiveQuarterlyTarget, 0);
  return {
    id: budget.id,
    year: budget.year,
    quarter: budget.quarter,
    estimatedQuarterlyIncome: budget.estimatedQuarterlyIncome,
    note: budget.note,
    allocations,
    effectiveQuarterlyExpenseTotal,
    plannedFinancialGoalsAvailability: budget.estimatedQuarterlyIncome - effectiveQuarterlyExpenseTotal,
    effectiveExpensePercentage: percentage(effectiveQuarterlyExpenseTotal, budget.estimatedQuarterlyIncome),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  };
}

function toAllocationDto(allocation: BudgetAllocation & { category: Category }, estimatedQuarterlyIncome: number): BudgetAllocationDto {
  const suggestedQuarterlyTarget = Math.round((estimatedQuarterlyIncome * allocation.targetPercentageBasis) / 10_000);
  const effectiveQuarterlyTarget = allocation.adjustedMonthlyAmount * 3;
  return {
    categoryId: allocation.categoryId,
    category: { id: allocation.category.id, name: allocation.category.name, color: allocation.category.color, isActive: allocation.category.isActive },
    targetPercentage: allocation.targetPercentageBasis / 100,
    suggestedQuarterlyTarget,
    suggestedMonthlyTarget: Math.round(suggestedQuarterlyTarget / 3),
    adjustedMonthlyAmount: allocation.adjustedMonthlyAmount,
    effectiveQuarterlyTarget,
    effectivePercentage: percentage(effectiveQuarterlyTarget, estimatedQuarterlyIncome),
    note: allocation.note,
  };
}

function percentage(amount: number, total: number): number {
  return Math.round((amount * 10_000) / total) / 100;
}

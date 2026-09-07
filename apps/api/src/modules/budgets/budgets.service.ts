import { Injectable } from '@nestjs/common';

import { type Budget } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

import { BudgetDto } from './dto/budget.dto';
import { PutBudgetDto } from './dto/put-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string, year: number, quarter: number): Promise<BudgetDto | null> {
    const budget = await this.prisma.budget.findUnique({ where: { userId_year_quarter: { userId, year, quarter } } });
    return budget && toDto(budget);
  }

  async put(userId: string, year: number, quarter: number, dto: PutBudgetDto): Promise<BudgetDto> {
    const budget = await this.prisma.budget.upsert({
      where: { userId_year_quarter: { userId, year, quarter } },
      create: { userId, year, quarter, ...dto },
      update: dto,
    });
    return toDto(budget);
  }
}

function toDto(budget: Budget): BudgetDto {
  return {
    id: budget.id,
    year: budget.year,
    quarter: budget.quarter,
    estimatedQuarterlyIncome: budget.estimatedQuarterlyIncome,
    note: budget.note,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  };
}

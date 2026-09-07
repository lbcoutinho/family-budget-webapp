import { Body, Controller, Get, Param, Put, Res } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';

import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { BudgetsService } from './budgets.service';
import { BudgetPeriodDto } from './dto/budget-period.dto';
import { BudgetDto } from './dto/budget.dto';
import { PutBudgetDto } from './dto/put-budget.dto';

@ApiTags('budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @ApiOperation({ operationId: 'getBudget', summary: "Read one of the user's quarterly Budgets" })
  @ApiParam({ name: 'year', type: Number })
  @ApiParam({ name: 'quarter', type: Number })
  @ApiOkResponse({ type: BudgetDto })
  @ApiNoContentResponse({ description: 'This quarter has no Budget yet.' })
  @Get(':year/:quarter')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param() period: BudgetPeriodDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BudgetDto | undefined> {
    const budget = await this.budgets.findOne(user.id, period.year, period.quarter);
    if (budget === null) response.status(204);
    return budget ?? undefined;
  }

  @ApiOperation({ operationId: 'putBudget', summary: 'Create or replace one quarterly Budget' })
  @ApiParam({ name: 'year', type: Number })
  @ApiParam({ name: 'quarter', type: Number })
  @ApiBody({ type: PutBudgetDto })
  @ApiOkResponse({ type: BudgetDto })
  @Put(':year/:quarter')
  put(@CurrentUser() user: AuthenticatedUser, @Param() period: BudgetPeriodDto, @Body() dto: PutBudgetDto): Promise<BudgetDto> {
    return this.budgets.put(user.id, period.year, period.quarter, dto);
  }
}

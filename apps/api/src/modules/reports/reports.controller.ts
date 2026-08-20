import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CashboxesReportQueryDto } from './dto/cashboxes-report-query.dto';
import { CashboxesReportDto } from './dto/cashboxes-report.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { MonthlyReportDto } from './dto/monthly-report.dto';
import { YearlyReportQueryDto } from './dto/yearly-report-query.dto';
import { YearlyReportDto } from './dto/yearly-report.dto';
import { ReportsService } from './reports.service';

/**
 * HTTP for reports (M6-T01). No `@Public()`: the global `JwtAuthGuard` protects every route, and
 * `@CurrentUser()` scopes each one to its owner.
 *
 * `@ApiQuery` is declared here even though `MonthlyReportQueryDto` already says so — same reason as
 * `TransactionsController`: the swagger CLI plugin is off, so a parameter Nest cannot see ends up
 * missing from `openapi.json`, and therefore from the generated client's signature, silently.
 */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @ApiOperation({ operationId: 'getMonthlyReport', summary: 'Spend and income by category for one month, with cashbox activity' })
  @ApiQuery({ name: 'year', type: Number, required: true, schema: { minimum: 2000, maximum: 2100 } })
  @ApiQuery({ name: 'month', type: Number, required: true, schema: { minimum: 1, maximum: 12 } })
  @ApiOkResponse({ type: MonthlyReportDto })
  @Get('monthly')
  getMonthly(@CurrentUser() user: AuthenticatedUser, @Query() query: MonthlyReportQueryDto): Promise<MonthlyReportDto> {
    return this.reports.getMonthly(user.id, query.year, query.month);
  }

  @ApiOperation({ operationId: 'getYearlyReport', summary: 'Income and expense by category across a year, as a month-by-category matrix' })
  @ApiQuery({ name: 'year', type: Number, required: true, schema: { minimum: 2000, maximum: 2100 } })
  @ApiQuery({ name: 'compare', type: Boolean, required: false })
  @ApiOkResponse({ type: YearlyReportDto })
  @Get('yearly')
  getYearly(@CurrentUser() user: AuthenticatedUser, @Query() query: YearlyReportQueryDto): Promise<YearlyReportDto> {
    return this.reports.getYearly(user.id, query.year, query.compare ?? false);
  }

  @ApiOperation({
    operationId: 'getCashboxesReport',
    summary: "Each cashbox's monthly balance evolution across a year, deposits/withdrawals and progress toward its target",
  })
  @ApiQuery({ name: 'year', type: Number, required: true, schema: { minimum: 2000, maximum: 2100 } })
  @ApiOkResponse({ type: CashboxesReportDto })
  @Get('cashboxes')
  getCashboxes(@CurrentUser() user: AuthenticatedUser, @Query() query: CashboxesReportQueryDto): Promise<CashboxesReportDto> {
    return this.reports.cashboxes(user.id, query.year);
  }
}

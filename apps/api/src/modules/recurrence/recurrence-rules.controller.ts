import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ApiErrorDto } from '../../common/api-error';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CancelInstallmentPlanResultDto } from './dto/cancel-installment-plan-result.dto';
import { CreateInstallmentPlanDto } from './dto/create-installment-plan.dto';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { GenerateRecurrenceRuleResultDto } from './dto/generate-recurrence-rule-result.dto';
import { InstallmentPlanDto } from './dto/installment-plan.dto';
import { ListRecurrenceRulesQueryDto } from './dto/list-recurrence-rules-query.dto';
import { PreviewQueryDto } from './dto/preview-query.dto';
import { PreviewRecurrenceRulePayloadDto } from './dto/preview-recurrence-rule-payload.dto';
import { PreviewRecurrenceRuleDto } from './dto/preview-recurrence-rule.dto';
import { RecurrenceRuleDto } from './dto/recurrence-rule.dto';
import { UpdateRecurrenceRuleDto } from './dto/update-recurrence-rule.dto';
import { InstallmentsService } from './installments.service';
import { RecurrenceRulesService } from './recurrence-rules.service';

/**
 * HTTP for recurrence rules — CRUD plus manual generation and a non-persisting preview (M7-T03).
 * No `@Public()` anywhere: the global `JwtAuthGuard` protects every route, and `@CurrentUser()` is
 * what scopes each one to its owner.
 *
 * The 404 documented on every by-id route covers both "no such rule" and "not yours" — telling them
 * apart would confirm the id exists to whoever asked.
 *
 * Bodies and query parameters are declared with `@ApiBody` / `@ApiQuery` even though the argument
 * types already say so: the swagger CLI plugin is not enabled, so a parameter Nest cannot see ends
 * up missing from `openapi.json` — and therefore from the generated client's signature, silently.
 */
@ApiTags('recurrence-rules')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such recurrence rule — or it belongs to another user.' })
@Controller('recurrence-rules')
export class RecurrenceRulesController {
  constructor(
    private readonly recurrenceRules: RecurrenceRulesService,
    private readonly installments: InstallmentsService,
  ) {}

  @ApiOperation({ operationId: 'listRecurrenceRules', summary: "List the user's recurrence rules" })
  @ApiQuery({ name: 'includeInactive', type: Boolean, required: false, description: 'Include deactivated rules. Off by default.' })
  @ApiQuery({ name: 'includeId', type: String, format: 'uuid', required: false, description: 'Also return this one rule, active or not.' })
  @ApiOkResponse({ type: [RecurrenceRuleDto], description: 'Active rules, ordered by description.' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListRecurrenceRulesQueryDto): Promise<RecurrenceRuleDto[]> {
    return this.recurrenceRules.findAll(user.id, query);
  }

  @ApiOperation({ operationId: 'getRecurrenceRule', summary: 'Read one recurrence rule' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: RecurrenceRuleDto })
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<RecurrenceRuleDto> {
    return this.recurrenceRules.findOne(user.id, id);
  }

  @ApiOperation({ operationId: 'createRecurrenceRule', summary: 'Create a recurrence rule' })
  @ApiBody({ type: CreateRecurrenceRuleDto })
  @ApiCreatedResponse({ type: RecurrenceRuleDto })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurrenceRuleDto): Promise<RecurrenceRuleDto> {
    return this.recurrenceRules.create(user.id, dto);
  }

  @ApiOperation({ operationId: 'updateRecurrenceRule', summary: 'Update a recurrence rule' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateRecurrenceRuleDto })
  @ApiOkResponse({ type: RecurrenceRuleDto })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecurrenceRuleDto): Promise<RecurrenceRuleDto> {
    return this.recurrenceRules.update(user.id, id, dto);
  }

  @ApiOperation({
    operationId: 'deleteRecurrenceRule',
    summary: 'Delete a recurrence rule, or deactivate it if it already generated transactions',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: RecurrenceRuleDto, description: 'Deleted outright, or deactivated (and returned) when generated transactions exist.' })
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<RecurrenceRuleDto> {
    return this.recurrenceRules.remove(user.id, id);
  }

  @ApiOperation({ operationId: 'generateRecurrenceRule', summary: 'Manually run generation for this rule, up to the rolling horizon' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: GenerateRecurrenceRuleResultDto })
  @Post(':id/generate')
  generate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<GenerateRecurrenceRuleResultDto> {
    return this.recurrenceRules.generate(user.id, id);
  }

  @ApiOperation({ operationId: 'previewRecurrenceRule', summary: 'Preview upcoming occurrences without persisting them' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'months', type: Number, required: false, description: 'How many months ahead to preview. Defaults to 12.' })
  @ApiOkResponse({ type: PreviewRecurrenceRuleDto })
  @Get(':id/preview')
  preview(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Query() query: PreviewQueryDto): Promise<PreviewRecurrenceRuleDto> {
    return this.recurrenceRules.preview(user.id, id, query.months);
  }

  @ApiOperation({
    operationId: 'previewRecurrenceRulePayload',
    summary: 'Preview upcoming occurrences for an unsaved rule payload — persists nothing',
  })
  @ApiBody({ type: PreviewRecurrenceRulePayloadDto })
  @ApiOkResponse({ type: PreviewRecurrenceRuleDto })
  @HttpCode(HttpStatus.OK)
  @Post('preview')
  previewPayload(@Body() dto: PreviewRecurrenceRulePayloadDto): PreviewRecurrenceRuleDto {
    return this.recurrenceRules.previewPayload(dto);
  }

  @ApiOperation({
    operationId: 'deactivateRecurrenceRule',
    summary: 'Deactivate a recurrence rule, keeping it and its generated transactions',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: RecurrenceRuleDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<RecurrenceRuleDto> {
    return this.recurrenceRules.deactivate(user.id, id);
  }

  @ApiOperation({
    operationId: 'createInstallmentPlan',
    summary: 'Create an installment plan, materializing every installment up front',
  })
  @ApiBody({ type: CreateInstallmentPlanDto })
  @ApiCreatedResponse({ type: InstallmentPlanDto })
  @Post('installment')
  createInstallmentPlan(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInstallmentPlanDto): Promise<InstallmentPlanDto> {
    return this.installments.createPlan(user.id, dto);
  }

  @ApiOperation({
    operationId: 'cancelInstallmentPlan',
    summary: 'Cancel an installment plan: remove future, unconfirmed installments and deactivate the rule',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CancelInstallmentPlanResultDto })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel-installments')
  cancelInstallmentPlan(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CancelInstallmentPlanResultDto> {
    return this.installments.cancelPlan(user.id, id);
  }
}

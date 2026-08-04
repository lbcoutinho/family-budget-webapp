import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../../common/api-error';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CashboxesService } from './cashboxes.service';
import { CashboxDto } from './dto/cashbox.dto';
import { CreateCashboxDto } from './dto/create-cashbox.dto';
import { ListCashboxesQueryDto } from './dto/list-cashboxes-query.dto';
import { UpdateCashboxDto } from './dto/update-cashbox.dto';

/**
 * HTTP for the cashboxes master data (M3-T05). No `@Public()` anywhere: the global `JwtAuthGuard`
 * protects every route here, and `@CurrentUser()` is what scopes each one to its owner.
 *
 * The 404 documented on every by-id route covers both "no such cashbox" and "not yours" — telling
 * them apart would confirm the id exists to whoever asked.
 *
 * Bodies and query parameters are declared with `@ApiBody` / `@ApiQuery` even though the argument
 * types already say so: the swagger CLI plugin is not enabled, so a parameter Nest cannot see ends
 * up missing from `openapi.json` — and therefore from the generated client's signature, silently.
 */
@ApiTags('cashboxes')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such cashbox — or it belongs to another user.' })
@Controller('cashboxes')
export class CashboxesController {
  constructor(private readonly cashboxes: CashboxesService) {}

  @ApiOperation({ operationId: 'listCashboxes', summary: "List the user's cashboxes" })
  @ApiQuery({ name: 'includeInactive', type: Boolean, required: false, description: 'Include deactivated cashboxes. Off by default.' })
  @ApiQuery({ name: 'includeId', type: String, format: 'uuid', required: false, description: 'Also return this one cashbox, active or not.' })
  @ApiOkResponse({ type: [CashboxDto], description: 'Active cashboxes, ordered by sort order and then name.' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCashboxesQueryDto): Promise<CashboxDto[]> {
    return this.cashboxes.findAll(user.id, query);
  }

  @ApiOperation({ operationId: 'getCashbox', summary: 'Read one cashbox' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CashboxDto })
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CashboxDto> {
    return this.cashboxes.findOne(user.id, id);
  }

  @ApiOperation({ operationId: 'createCashbox', summary: 'Create a cashbox' })
  @ApiBody({ type: CreateCashboxDto })
  @ApiCreatedResponse({ type: CashboxDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'The user already has a cashbox with that name.' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCashboxDto): Promise<CashboxDto> {
    return this.cashboxes.create(user.id, dto);
  }

  @ApiOperation({ operationId: 'updateCashbox', summary: 'Update a cashbox' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateCashboxDto })
  @ApiOkResponse({ type: CashboxDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'The user already has another cashbox with that name.' })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCashboxDto): Promise<CashboxDto> {
    return this.cashboxes.update(user.id, id, dto);
  }

  @ApiOperation({ operationId: 'activateCashbox', summary: 'Put a retired cashbox back into use' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CashboxDto })
  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CashboxDto> {
    return this.cashboxes.setActive(user.id, id, true);
  }

  @ApiOperation({ operationId: 'deactivateCashbox', summary: 'Retire a cashbox, keeping its history' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: CashboxDto })
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<CashboxDto> {
    return this.cashboxes.setActive(user.id, id, false);
  }

  @ApiOperation({ operationId: 'deleteCashbox', summary: 'Delete a cashbox for good' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted. Nothing referenced it.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Records still reference this cashbox — deactivate it instead of deleting it.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.cashboxes.remove(user.id, id);
  }
}

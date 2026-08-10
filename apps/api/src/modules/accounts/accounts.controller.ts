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
import { AsOfQueryDto } from '../../common/dto/as-of-query.dto';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { AccountsService } from './accounts.service';
import { AccountBalanceDto } from './dto/account-balance.dto';
import { AccountDto } from './dto/account.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * HTTP for the accounts master data. No `@Public()` anywhere: the global `JwtAuthGuard` protects
 * every route here, and `@CurrentUser()` is what scopes each one to its owner.
 *
 * The 404 documented on every by-id route covers both "no such account" and "not yours" — telling
 * them apart would confirm the id exists to whoever asked.
 *
 * Bodies and query parameters are declared with `@ApiBody` / `@ApiQuery` even though the argument
 * types already say so: the swagger CLI plugin is not enabled, so a parameter Nest cannot see ends
 * up missing from `openapi.json` — and therefore from the generated client's signature, silently.
 */
@ApiTags('accounts')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such account — or it belongs to another user.' })
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @ApiOperation({ operationId: 'listAccounts', summary: "List the user's accounts" })
  @ApiQuery({ name: 'includeInactive', type: Boolean, required: false, description: 'Include deactivated accounts. Off by default.' })
  @ApiQuery({ name: 'includeId', type: String, format: 'uuid', required: false, description: 'Also return this one account, active or not.' })
  @ApiOkResponse({ type: [AccountDto], description: 'Active accounts, ordered by sort order and then name.' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAccountsQueryDto): Promise<AccountDto[]> {
    return this.accounts.findAll(user.id, query);
  }

  // Declared before `:id` — Nest matches routes in declaration order, and `ParseUUIDPipe` on the
  // route below would otherwise answer 400 for this path.
  @ApiOperation({ operationId: 'listAccountBalances', summary: "The user's account balances" })
  @ApiQuery({ name: 'asOf', type: String, format: 'date', required: false, description: 'Balance as of the end of this day (YYYY-MM-DD).' })
  @ApiOkResponse({ type: [AccountBalanceDto], description: 'Every account, active or not, ordered by sort order and then name.' })
  @Get('balances')
  findBalances(@CurrentUser() user: AuthenticatedUser, @Query() query: AsOfQueryDto): Promise<AccountBalanceDto[]> {
    return this.accounts.findBalances(user.id, query.asOf);
  }

  @ApiOperation({ operationId: 'getAccount', summary: 'Read one account' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AccountDto })
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AccountDto> {
    return this.accounts.findOne(user.id, id);
  }

  @ApiOperation({ operationId: 'createAccount', summary: 'Create an account' })
  @ApiBody({ type: CreateAccountDto })
  @ApiCreatedResponse({ type: AccountDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'The user already has an account with that name.' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountDto): Promise<AccountDto> {
    return this.accounts.create(user.id, dto);
  }

  @ApiOperation({ operationId: 'updateAccount', summary: 'Update an account' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateAccountDto })
  @ApiOkResponse({ type: AccountDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'The user already has another account with that name.' })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto): Promise<AccountDto> {
    return this.accounts.update(user.id, id, dto);
  }

  @ApiOperation({ operationId: 'activateAccount', summary: 'Put a retired account back into use' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AccountDto })
  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AccountDto> {
    return this.accounts.setActive(user.id, id, true);
  }

  @ApiOperation({ operationId: 'deactivateAccount', summary: 'Retire an account, keeping its history' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AccountDto })
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AccountDto> {
    return this.accounts.setActive(user.id, id, false);
  }

  @ApiOperation({ operationId: 'deleteAccount', summary: 'Delete an account for good' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted. Nothing referenced it.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Records still reference this account — deactivate it instead of deleting it.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.accounts.remove(user.id, id);
  }
}

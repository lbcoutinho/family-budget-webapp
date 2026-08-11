import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { TransactionStatus, TransactionType } from '../../generated/prisma/client';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { TransactionListDto } from './dto/transaction-list.dto';
import { TransactionDto } from './dto/transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

/**
 * HTTP for transactions (M4-T04, M4-T05, M4-T08). No `@Public()` anywhere: the global
 * `JwtAuthGuard` protects every route, and `@CurrentUser()` scopes each one to its owner.
 *
 * The 404 documented on every by-id route covers both "no such transaction" and "not yours" —
 * telling them apart would confirm the id exists to whoever asked.
 *
 * The list route's filters are declared with `@ApiQuery` even though `ListTransactionsQueryDto`
 * already says so: the swagger CLI plugin is not enabled, so a parameter Nest cannot see ends up
 * missing from `openapi.json` — and therefore from the generated client's signature, silently.
 */
@ApiTags('transactions')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such transaction — or it belongs to another user.' })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @ApiOperation({ operationId: 'listTransactions', summary: 'List transactions with filters and pagination' })
  @ApiQuery({ name: 'referenceMonth', type: String, format: 'date', required: false, description: 'Normalized to the 1st before matching.' })
  @ApiQuery({ name: 'dateFrom', type: String, format: 'date', required: false, description: 'Inclusive lower bound on `date`.' })
  @ApiQuery({ name: 'dateTo', type: String, format: 'date', required: false, description: 'Inclusive upper bound on `date`.' })
  @ApiQuery({ name: 'type', enum: TransactionType, enumName: 'TransactionType', isArray: true, required: false })
  @ApiQuery({
    name: 'status',
    enum: TransactionStatus,
    enumName: 'TransactionStatus',
    required: false,
    description: 'Omitted ⇒ `CONFIRMED` only (ADR-0012) — balances and reports never see a `DRAFT`.',
  })
  @ApiQuery({
    name: 'accountId',
    type: String,
    format: 'uuid',
    required: false,
    description: 'Matches the source `accountId` only — a TRANSFER shows up under it.',
  })
  @ApiQuery({ name: 'categoryId', type: String, format: 'uuid', required: false })
  @ApiQuery({ name: 'subcategoryId', type: String, format: 'uuid', required: false })
  @ApiQuery({
    name: 'cashboxId',
    type: String,
    format: 'uuid',
    required: false,
    description: 'Matches the live foreign key only — a row whose cashbox was since deleted is excluded (ADR-0019).',
  })
  @ApiQuery({ name: 'isCreditCard', type: Boolean, required: false })
  @ApiQuery({ name: 'search', type: String, required: false, description: 'Case-insensitive, matches `description` or `notes`.' })
  @ApiQuery({
    name: 'cursor',
    type: String,
    format: 'uuid',
    required: false,
    description: 'Opaque to the client — the id of the last row of the previous page.',
  })
  @ApiQuery({ name: 'limit', type: Number, required: false, schema: { default: 50, minimum: 1, maximum: 200 } })
  @ApiOkResponse({ type: TransactionListDto })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListTransactionsQueryDto): Promise<TransactionListDto> {
    return this.transactions.findAll(user.id, query);
  }

  @ApiOperation({ operationId: 'getTransaction', summary: 'Read one transaction' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TransactionDto })
  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<TransactionDto> {
    return this.transactions.findOne(user.id, id);
  }

  @ApiOperation({ operationId: 'createTransaction', summary: 'Create a transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiCreatedResponse({ type: TransactionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Invalid fields for the transaction type, or a deactivated reference.' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'CASHBOX_OUT or CASHBOX_TRANSFER would drive a cashbox balance negative.' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTransactionDto): Promise<TransactionDto> {
    return this.transactions.create(user.id, dto);
  }

  @ApiOperation({ operationId: 'updateTransaction', summary: 'Update a transaction' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiOkResponse({ type: TransactionDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Invalid fields for the transaction type, a deactivated reference, or an attempt to change `type`.',
  })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'CASHBOX_OUT or CASHBOX_TRANSFER would drive a cashbox balance negative.' })
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTransactionDto): Promise<TransactionDto> {
    return this.transactions.update(user.id, id, dto);
  }

  @ApiOperation({ operationId: 'deleteTransaction', summary: 'Delete a transaction for good' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted. A transaction has no history worth preserving.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.transactions.remove(user.id, id);
  }
}

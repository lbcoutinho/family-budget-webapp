import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
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
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorDto } from '../../common/api-error';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionDto } from './dto/transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

/**
 * HTTP for transactions (M4-T04, M4-T05). No `@Public()` anywhere: the global
 * `JwtAuthGuard` protects every route, and `@CurrentUser()` scopes each one to its owner.
 *
 * The 404 documented on every by-id route covers both "no such transaction" and "not yours" —
 * telling them apart would confirm the id exists to whoever asked.
 *
 * No `GET /transactions` (a list) here — that is #105.
 */
@ApiTags('transactions')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such transaction — or it belongs to another user.' })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

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

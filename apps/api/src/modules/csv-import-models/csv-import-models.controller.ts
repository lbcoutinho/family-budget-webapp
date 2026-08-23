import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
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

import { CsvImportModelsService } from './csv-import-models.service';
import { CreateCsvImportModelDto } from './dto/create-csv-import-model.dto';
import { CsvImportModelDto } from './dto/csv-import-model.dto';

@ApiTags('csv-import-models')
@ApiNotFoundResponse({ type: ApiErrorDto, description: 'No such CSV import model — or it belongs to another user.' })
@Controller('csv-import-models')
export class CsvImportModelsController {
  constructor(private readonly models: CsvImportModelsService) {}

  @ApiOperation({ operationId: 'listCsvImportModels', summary: "List the user's CSV import models" })
  @ApiOkResponse({ type: [CsvImportModelDto], description: 'Models ordered by name.' })
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<CsvImportModelDto[]> {
    return this.models.findAll(user.id);
  }

  @ApiOperation({ operationId: 'createCsvImportModel', summary: 'Create a CSV import model' })
  @ApiBody({ type: CreateCsvImportModelDto })
  @ApiCreatedResponse({ type: CsvImportModelDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'The user already has a CSV import model with that name.' })
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCsvImportModelDto): Promise<CsvImportModelDto> {
    return this.models.create(user.id, dto);
  }

  @ApiOperation({ operationId: 'deleteCsvImportModel', summary: 'Delete a CSV import model' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Deleted. Transactions are unaffected.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.models.remove(user.id, id);
  }
}

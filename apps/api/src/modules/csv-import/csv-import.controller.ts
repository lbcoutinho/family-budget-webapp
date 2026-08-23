import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { CsvImportService } from './csv-import.service';
import { ConfirmCsvImportDto, CsvImportRequestDto } from './dto/csv-import-request.dto';
import { CsvImportResultDto } from './dto/csv-import-result.dto';

const upload = FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
interface UploadedCsv {
  buffer: Buffer;
}

@ApiTags('csv-import')
@ApiConsumes('multipart/form-data')
@Controller('csv-import')
export class CsvImportController {
  constructor(private readonly imports: CsvImportService) {}

  @ApiOperation({ operationId: 'previewCsvImport', summary: 'Preview a CSV transaction import without writing transactions' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['modelId', 'accountId', 'file'],
      properties: { modelId: { type: 'string', format: 'uuid' }, accountId: { type: 'string', format: 'uuid' }, file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: CsvImportResultDto })
  @UseInterceptors(upload)
  @Post('preview')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CsvImportRequestDto,
    @UploadedFile() file: UploadedCsv | undefined,
  ): Promise<CsvImportResultDto> {
    return this.imports.preview(user.id, dto, file?.buffer);
  }

  @ApiOperation({ operationId: 'confirmCsvImport', summary: 'Atomically create selected new CSV rows as drafts' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['modelId', 'accountId', 'selectedLines', 'file'],
      properties: {
        modelId: { type: 'string', format: 'uuid' },
        accountId: { type: 'string', format: 'uuid' },
        selectedLines: { type: 'array', items: { type: 'integer' } },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOkResponse({ type: CsvImportResultDto })
  @UseInterceptors(upload)
  @Post('confirm')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmCsvImportDto,
    @UploadedFile() file: UploadedCsv | undefined,
  ): Promise<CsvImportResultDto> {
    return this.imports.confirm(user.id, dto, file?.buffer);
  }
}

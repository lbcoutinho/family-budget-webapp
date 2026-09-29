import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { InvestmentImportConfirmationDto, InvestmentImportPreviewDto, InvestmentImportRollbackPreviewDto } from './dto/investment-import-preview.dto';
import { InvestmentImportService } from './investment-import.service';

interface UploadedCsv {
  buffer: Buffer;
}

@ApiTags('investment-import')
@ApiConsumes('multipart/form-data')
@Controller('investment-import')
export class InvestmentImportController {
  constructor(private readonly imports: InvestmentImportService) {}

  @ApiOperation({ operationId: 'previewInvestmentImport', summary: 'Validate and simulate a normalized investment CSV without writing data' })
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: InvestmentImportPreviewDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @Post('preview')
  preview(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: UploadedCsv | undefined): Promise<InvestmentImportPreviewDto> {
    return this.imports.preview(user.id, file?.buffer);
  }

  @ApiOperation({ operationId: 'confirmInvestmentImport', summary: 'Atomically persist a validated normalized investment CSV' })
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiCreatedResponse({ type: InvestmentImportConfirmationDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @Post('confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: UploadedCsv | undefined): Promise<InvestmentImportConfirmationDto> {
    return this.imports.confirm(user.id, file?.buffer);
  }

  @ApiOperation({ operationId: 'previewInvestmentImportRollback', summary: 'Preview the impact of removing a whole import batch' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: InvestmentImportRollbackPreviewDto })
  @Get(':id/rollback-preview')
  previewRollback(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<InvestmentImportRollbackPreviewDto> {
    return this.imports.previewRollback(user.id, id);
  }

  @ApiOperation({ operationId: 'rollbackInvestmentImport', summary: 'Atomically remove a whole import batch after preview' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  rollback(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.imports.rollback(user.id, id);
  }
}

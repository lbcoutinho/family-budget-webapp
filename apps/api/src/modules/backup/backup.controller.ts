import { Controller, ForbiddenException, Get, Res } from '@nestjs/common';
import { ApiConflictResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiProduces, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';

import { AuthService } from '../auth/auth.service';
import { type AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { DatabaseBackupService } from './database-backup.service';

@ApiTags('backup')
@Controller('backups')
export class BackupController {
  constructor(
    private readonly auth: AuthService,
    private readonly backups: DatabaseBackupService,
  ) {}

  @ApiOperation({ operationId: 'downloadDatabaseBackup', summary: 'Download a full PostgreSQL database backup' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'PostgreSQL custom-format dump attachment.', schema: { type: 'string', format: 'binary' } })
  @ApiForbiddenResponse({ description: 'Only the configured administrator can create backups.' })
  @ApiConflictResponse({ description: 'A backup is already in progress.' })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL 16 client tools are unavailable.' })
  @Get('database')
  async download(@CurrentUser() user: AuthenticatedUser, @Res() response: Response): Promise<void> {
    if (!this.auth.isAdmin(user.email)) {
      throw new ForbiddenException('Administrator access is required.');
    }

    await this.backups.stream(response);
  }
}

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { BackupLockService } from './backup-lock.service';
import { BackupController } from './backup.controller';
import { DatabaseBackupService } from './database-backup.service';

@Module({
  imports: [AuthModule],
  controllers: [BackupController],
  providers: [BackupLockService, DatabaseBackupService],
  exports: [BackupLockService],
})
export class BackupModule {}

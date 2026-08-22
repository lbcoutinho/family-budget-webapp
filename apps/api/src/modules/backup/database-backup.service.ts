import * as childProcess from 'node:child_process';

import { ConflictException, Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Response } from 'express';

import { BackupLockService } from './backup-lock.service';

@Injectable()
export class DatabaseBackupService {
  constructor(
    private readonly config: ConfigService,
    private readonly lock: BackupLockService,
  ) {}

  async stream(response: Response): Promise<void> {
    if (!this.lock.acquire()) {
      throw new ConflictException('A database backup is already in progress.');
    }

    try {
      await this.assertPgDumpAvailable();
      await this.dump(response);
    } finally {
      this.lock.release();
    }
  }

  private async assertPgDumpAvailable(): Promise<void> {
    const version = await this.run(['--version']);

    if (!version.includes('PostgreSQL) 16.')) {
      throw new ServiceUnavailableException('PostgreSQL 16 client tools are required: install pg_dump 16 and try again.');
    }
  }

  private async dump(response: Response): Promise<void> {
    const child = childProcess.spawn('pg_dump', ['--format=custom', '--dbname', this.config.getOrThrow<string>('DATABASE_URL')], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await new Promise<void>((resolve, reject) => {
      const abort = (): void => {
        if (!response.writableEnded) {
          child.kill();
        }
      };
      const done = (): void => {
        response.off('close', abort);
      };

      response.once('close', abort);
      child.once('error', (error: NodeJS.ErrnoException) => {
        done();
        reject(this.pgDumpError(error));
      });
      child.once('close', (code) => {
        done();
        if (code === 0) {
          resolve();
        } else {
          reject(new InternalServerErrorException('Database backup failed.'));
        }
      });

      response.attachment(this.filename());
      response.type('application/octet-stream');
      child.stdout.pipe(response);
    });
  }

  private async run(args: string[]): Promise<string> {
    const child = childProcess.spawn('pg_dump', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.once('error', (error: NodeJS.ErrnoException) => reject(this.pgDumpError(error)));
      child.once('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks).toString());
        } else {
          reject(new ServiceUnavailableException('PostgreSQL 16 client tools are required: install pg_dump 16 and try again.'));
        }
      });
    });
  }

  private pgDumpError(error: NodeJS.ErrnoException): ServiceUnavailableException {
    if (error.code === 'ENOENT') {
      return new ServiceUnavailableException('PostgreSQL 16 client tools are required: install pg_dump 16 and try again.');
    }

    return new ServiceUnavailableException('Unable to start pg_dump for the database backup.');
  }

  private filename(): string {
    return `family-budget-backup-${new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\.\d{3}Z$/, 'Z')}.dump`;
  }
}

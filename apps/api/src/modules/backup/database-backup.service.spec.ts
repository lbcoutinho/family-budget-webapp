import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { type Response } from 'express';

import { BackupLockService } from './backup-lock.service';
import { DatabaseBackupService } from './database-backup.service';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

class FakeChildProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly kill = jest.fn();
}

describe('DatabaseBackupService', () => {
  let lock: BackupLockService;
  let service: DatabaseBackupService;
  const spawn = childProcess.spawn as jest.MockedFunction<typeof childProcess.spawn>;

  const response = (): Response => Object.assign(new PassThrough(), { attachment: jest.fn(), type: jest.fn() }) as unknown as Response;

  beforeEach(() => {
    lock = new BackupLockService();
    service = new DatabaseBackupService({ getOrThrow: () => 'postgresql://user:secret@localhost:5432/budget?schema=public' } as unknown as ConfigService, lock);
    spawn.mockReset();
  });

  it('streams a custom dump and releases the lock when it completes', async () => {
    spawn.mockImplementation((_command, args) => {
      const child = new FakeChildProcess();
      process.nextTick(() => {
        child.stdout.end(args[0] === '--version' ? 'pg_dump (PostgreSQL) 18.6\n' : 'dump');
        child.emit('close', 0);
      });
      return child as unknown as childProcess.ChildProcess;
    });

    const download = response();
    await service.stream(download);

    expect(spawn).toHaveBeenNthCalledWith(2, 'pg_dump', ['--format=custom', '--dbname', 'postgresql://user:secret@localhost:5432/budget'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(download.attachment).toHaveBeenCalledWith(expect.stringMatching(/^family-budget-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.dump$/));
    expect(lock.isLocked()).toBe(false);
  });

  it('reports a missing pg_dump clearly and releases the lock', async () => {
    spawn.mockImplementation(() => {
      const child = new FakeChildProcess();
      process.nextTick(() => child.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' })));
      return child as unknown as childProcess.ChildProcess;
    });

    await expect(service.stream(response())).rejects.toThrow(ServiceUnavailableException);
    expect(lock.isLocked()).toBe(false);
  });

  it('rejects a concurrent backup before starting another process', async () => {
    lock.acquire();

    await expect(service.stream(response())).rejects.toThrow(ConflictException);
    expect(spawn).not.toHaveBeenCalled();
  });
});

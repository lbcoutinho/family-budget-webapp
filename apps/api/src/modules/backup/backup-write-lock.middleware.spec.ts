import { ServiceUnavailableException } from '@nestjs/common';

import { BackupLockService } from './backup-lock.service';
import { BackupWriteLockMiddleware } from './backup-write-lock.middleware';

describe('BackupWriteLockMiddleware', () => {
  const next = jest.fn();
  let lock: BackupLockService;
  let middleware: BackupWriteLockMiddleware;

  beforeEach(() => {
    lock = new BackupLockService();
    middleware = new BackupWriteLockMiddleware(lock);
    next.mockReset();
  });

  it('rejects domain writes while allowing reads and authentication', () => {
    lock.acquire();

    expect(() => middleware.use({ method: 'POST', path: '/accounts' } as never, {} as never, next)).toThrow(ServiceUnavailableException);

    middleware.use({ method: 'GET', path: '/accounts' } as never, {} as never, next);
    middleware.use({ method: 'POST', originalUrl: '/api/auth/refresh' } as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});

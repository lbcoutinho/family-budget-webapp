import { Injectable, type NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

import { BackupLockService } from './backup-lock.service';

/** Stops domain mutations at the HTTP boundary while `pg_dump` owns the backup lock. */
@Injectable()
export class BackupWriteLockMiddleware implements NestMiddleware {
  constructor(private readonly lock: BackupLockService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);
    const isAuth = request.originalUrl === '/api/auth' || request.originalUrl?.startsWith('/api/auth/') === true;

    if (this.lock.isLocked() && isMutation && !isAuth) {
      throw new ServiceUnavailableException('Database backup in progress. Try again once it completes.');
    }

    next();
  }
}

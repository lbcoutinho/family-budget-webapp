import { Injectable } from '@nestjs/common';

/** In-process only: deploy a shared lock before running more than one API instance. */
@Injectable()
export class BackupLockService {
  private locked = false;

  acquire(): boolean {
    if (this.locked) {
      return false;
    }

    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}

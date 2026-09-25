import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { type Observable } from 'rxjs';

import { InvestmentsService } from './investments.service';

@Injectable()
export class MarketQuoteSyncInterceptor implements NestInterceptor {
  constructor(private readonly investments: InvestmentsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const user = context.switchToHttp().getRequest<{ user?: { id: string } }>().user;
    if (user) await this.investments.synchronizeQuotes(user.id);
    return next.handle();
  }
}

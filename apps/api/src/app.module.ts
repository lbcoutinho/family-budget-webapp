import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { validate } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CashboxesModule } from './modules/cashboxes/cashboxes.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Fail-fast env validation (M1-T03) wired in here: a missing or malformed variable throws
    // during module resolution, so the app refuses to boot instead of crashing on first use.
    // A single `.env` at the repository root feeds both docker-compose and the API. When the API
    // runs from `apps/api`, that file is two levels up; the cwd `.env` is tried first so a
    // per-app override still works.
    ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env', '../../.env'] }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Quiets request-completed noise in test runs (e2e prints one line per request); still
        // surfaces real problems since warn/error pass through.
        level: process.env.NODE_ENV === 'test' ? 'warn' : 'info',
        // Secrets must never reach the logs. Redaction covers auth headers and any `password`
        // field regardless of nesting depth.
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', '*.*.password'],
          censor: '[REDACTED]',
        },
        transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    CashboxesModule,
    CategoriesModule,
    ReportsModule,
    TransactionsModule,
    UsersModule,
  ],
})
export class AppModule {}

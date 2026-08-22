import 'reflect-metadata';

import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsString, Max, Min, validateSync } from 'class-validator';

/**
 * Allowed values for {@link EnvironmentVariables.NODE_ENV}.
 */
export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Schema of every environment variable the API reads at boot. Validation is fail-fast: the
 * application must refuse to start when a required variable is missing or malformed rather than
 * crash later on the first query. See AGENTS.md — "Env vars are validated at boot".
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  // Environment variables always arrive as strings; coerce to a number before range checks.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  REFRESH_TOKEN_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  REFRESH_TOKEN_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  ADMIN_EMAIL!: string;
}

/**
 * Validate a raw environment object against {@link EnvironmentVariables}.
 *
 * Wired into `ConfigModule.forRoot({ validate })` when the NestJS app is bootstrapped (M1-T04).
 * Throws an `Error` naming every offending variable so the boot failure is self-explanatory.
 */
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return validated;
}

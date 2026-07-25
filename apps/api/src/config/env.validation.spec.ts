import { EnvironmentVariables, NodeEnv, validate } from './env.validation';

const validEnv = (): Record<string, unknown> => ({
  NODE_ENV: NodeEnv.Test,
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/budget',
  JWT_SECRET: 'jwt-secret',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_SECRET: 'refresh-secret',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  CORS_ORIGIN: 'http://localhost:5173',
});

describe('validate (environment)', () => {
  it('accepts a complete configuration and coerces PORT to a number', () => {
    const result = validate(validEnv());

    expect(result).toBeInstanceOf(EnvironmentVariables);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe(NodeEnv.Test);
  });

  it('rejects a missing DATABASE_URL, naming the variable', () => {
    const withoutDatabaseUrl = validEnv();
    delete withoutDatabaseUrl.DATABASE_URL;

    expect(() => validate(withoutDatabaseUrl)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => validate({ ...validEnv(), PORT: 'not-a-number' })).toThrow(/PORT/);
  });
});

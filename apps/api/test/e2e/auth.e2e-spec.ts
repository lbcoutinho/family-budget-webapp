import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * The login flow end to end (M2-T03), against a real database and the real request pipeline —
 * global prefix, validation pipe, cookie parser. Requires the migrations to have been applied
 * (`pnpm --filter api db:migrate`).
 *
 * The fixture account is written here rather than by the seed, so the suite owns its data and
 * does not depend on whatever `SEED_USER_*` happens to hold.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  const email = 'auth.e2e@family-budget.test';
  const password = 'correct horse battery staple';

  /** Extract the refresh cookie from a `Set-Cookie` header, whatever order the attributes come in. */
  const refreshCookieFrom = (headers: Record<string, unknown>): string => {
    const setCookie = headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? (setCookie as string[]) : [];

    return cookies.find((cookie) => cookie.startsWith('refresh_token=')) ?? '';
  };

  /** Supertest types every body as `any`; these two say what the endpoint actually answers. */
  const sessionOf = (response: request.Response): SessionDto => response.body as SessionDto;
  const messageOf = (response: request.Response): string => (response.body as { message: string }).message;

  /** Just the token out of a `Set-Cookie` string, without the attributes that follow it. */
  const tokenIn = (cookie: string): string => cookie.split(';')[0]?.split('=')[1] ?? '';

  const login = async (body: { email: string; password: string }): Promise<request.Response> => request(server).post('/api/auth/login').send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    const passwordHash = await app.get(HashService).hash(password);

    await prisma.user.upsert({
      where: { email },
      create: { email, name: 'Auth E2E', passwordHash },
      update: { name: 'Auth E2E', passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('returns an access token and the account for valid credentials', async () => {
      const response = await login({ email, password });

      const session = sessionOf(response);

      expect(response.status).toBe(200);
      expect(typeof session.accessToken).toBe('string');
      expect(session.user).toEqual({ id: expect.any(String) as string, email, name: 'Auth E2E', locale: 'pt-BR' });
      expect(session.isAdmin).toBe(typeof process.env.ADMIN_EMAIL === 'string' && email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase());
      expect(session.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(response.body)).not.toContain(password);
    });

    it('sets the refresh token as an httpOnly, sameSite=strict cookie scoped to /api/auth', async () => {
      const cookie = refreshCookieFrom((await login({ email, password })).headers);

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/auth');
      // NODE_ENV is `test` here; `Secure` is only added in production, where the API is on HTTPS.
      expect(cookie).not.toContain('Secure');
      expect(cookie).toContain('Expires=');
    });

    it('answers a wrong password and an unknown address identically', async () => {
      const wrongPassword = await login({ email, password: 'not the password' });
      const unknownAddress = await login({ email: 'stranger@family-budget.test', password });

      expect(wrongPassword.status).toBe(401);
      expect(unknownAddress.status).toBe(401);
      expect(messageOf(wrongPassword)).toBe(messageOf(unknownAddress));
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('refuses a malformed body with the same 401, revealing nothing about the form', async () => {
      // Nest runs guards before pipes, so `LocalStrategy` answers before the validation pipe
      // ever sees the payload — a missing password is a failed login, not a 400.
      await request(server).post('/api/auth/login').send({ email: 'not-an-email', password: '' }).expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('issues a new access token for a valid cookie', async () => {
      const cookie = refreshCookieFrom((await login({ email, password })).headers);

      const response = await request(server).post('/api/auth/refresh').set('Cookie', cookie);

      const session = sessionOf(response);

      expect(response.status).toBe(200);
      expect(typeof session.accessToken).toBe('string');
      expect(session.user.email).toBe(email);
      expect(session.user.locale).toBe('pt-BR');
      expect(typeof session.isAdmin).toBe('boolean');
      // The cookie slides forward on every refresh, so an active session never expires mid-use.
      expect(refreshCookieFrom(response.headers)).toContain('HttpOnly');
    });

    it('rejects a missing cookie', async () => {
      await request(server).post('/api/auth/refresh').expect(401);
    });

    it('rejects a cookie whose signature has been tampered with', async () => {
      const token = tokenIn(refreshCookieFrom((await login({ email, password })).headers));

      await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${token.slice(0, -2)}xx`)
        .expect(401);
    });

    it('rejects the access token replayed as a refresh cookie', async () => {
      const { accessToken } = sessionOf(await login({ email, password }));

      await request(server).post('/api/auth/refresh').set('Cookie', `refresh_token=${accessToken}`).expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the cookie and answers 204', async () => {
      const cookie = refreshCookieFrom((await login({ email, password })).headers);

      const response = await request(server).post('/api/auth/logout').set('Cookie', cookie);

      expect(response.status).toBe(204);

      const cleared = refreshCookieFrom(response.headers);

      expect(cleared).toContain('refresh_token=;');
      expect(cleared).toContain('Path=/api/auth');
    });

    it('works without a cookie, so an expired session can still log out', async () => {
      await request(server).post('/api/auth/logout').expect(204);
    });
  });
});

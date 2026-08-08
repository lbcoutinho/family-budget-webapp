import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type AuthUserDto } from '../../src/modules/auth/dto/auth-user.dto';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * `PATCH /users/me` over the real request pipeline and a real database (M3-T12). A separate,
 * model-level suite already exists at `test/e2e/user.e2e-spec.ts` — this one is the endpoint.
 */
describe('Users API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let token: string;

  const password = 'correct horse battery staple';
  const email = 'users.api.e2e@family-budget.test';

  const authed = (path: string): request.Test => request(server).patch(`/api${path}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    const passwordHash = await app.get(HashService).hash(password);
    await prisma.user.upsert({ where: { email }, create: { email, name: 'Users E2E', passwordHash }, update: { passwordHash, locale: 'pt-BR' } });

    token = ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('refuses without a token', async () => {
    await request(server).patch('/api/users/me').send({ locale: 'en-US' }).expect(401);
  });

  it('updates the locale and hands back the AuthUserDto shape', async () => {
    const updated = (await authed('/users/me').send({ locale: 'en-US' }).expect(200)).body as AuthUserDto;

    expect(updated).toMatchObject({ email, locale: 'en-US' });
    expect(updated).not.toHaveProperty('passwordHash');
  });

  it('persists the locale, read back on a fresh login and a refresh', async () => {
    await authed('/users/me').send({ locale: 'en-US' }).expect(200);

    const session = (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto;
    expect(session.user.locale).toBe('en-US');
  });

  it.each([
    ['unsupported', 'fr-FR'],
    ['empty', ''],
    ['not a string', 1],
  ] as const)('rejects a locale that is %s with 400', async (_label, locale) => {
    await authed('/users/me').send({ locale }).expect(400);
  });

  it('rejects a body that also carries name with 400', async () => {
    await authed('/users/me').send({ locale: 'en-US', name: 'Someone Else' }).expect(400);
  });
});

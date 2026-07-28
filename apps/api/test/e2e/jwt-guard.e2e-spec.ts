import { type Server } from 'node:http';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type AuthenticatedUser } from '../../src/modules/auth/authenticated-user';
import { CurrentUser } from '../../src/modules/auth/decorators/current-user.decorator';
import { Public } from '../../src/modules/auth/decorators/public.decorator';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Two routes that exist only for this suite, registered alongside `AppModule` rather than shipped
 * in it. The claim under test is about routes *in general* — "anything written from here on is
 * protected unless it says otherwise" — and a real endpoint would prove it for itself only, while
 * also putting a fixture into the production surface and into the generated client.
 */
@Controller('probe')
class ProbeController {
  /** Carries no decorator at all. That is the point: the global guard still protects it. */
  @Get('protected')
  protectedRoute(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Public()
  @Get('open')
  openRoute(): { reached: boolean } {
    return { reached: true };
  }
}

/**
 * The global `JwtAuthGuard` (M2-T04) over the real request pipeline and a real database. Requires
 * the migrations to have been applied (`pnpm --filter api db:migrate`).
 */
describe('Global JWT guard (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let accessToken: string;
  let userId: string;

  const email = 'guard.e2e@family-budget.test';
  const password = 'correct horse battery staple';

  /** Sign an access-shaped token by hand, so a suite can produce one no login would hand out. */
  const forgeToken = (options: { secret: string; expiresIn: string }): string =>
    jwt.sign({ sub: userId, email }, { secret: options.secret, expiresIn: options.expiresIn as '15m' });

  const getProtected = (token?: string): request.Test => {
    const call = request(server).get('/api/probe/protected');

    return token === undefined ? call : call.set('Authorization', `Bearer ${token}`);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);

    const passwordHash = await app.get(HashService).hash(password);

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: 'Guard E2E', passwordHash },
      update: { name: 'Guard E2E', passwordHash },
    });

    userId = user.id;

    // The happy-path token comes from a real login rather than from `forgeToken`, so the suite
    // proves the token the API hands out is the token the guard accepts.
    const login = await request(server).post('/api/auth/login').send({ email, password });

    accessToken = (login.body as SessionDto).accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('protects a route that carries no decorator at all', async () => {
    await getProtected().expect(401);
  });

  it('admits a valid bearer token and hands the account to @CurrentUser()', async () => {
    const response = await getProtected(accessToken).expect(200);

    expect(response.body).toEqual({ id: userId, email });
  });

  it('rejects an expired token', async () => {
    await getProtected(forgeToken({ secret: config.getOrThrow<string>('JWT_SECRET'), expiresIn: '-1s' })).expect(401);
  });

  it('rejects a token whose signature does not check out', async () => {
    await getProtected(`${accessToken.slice(0, -2)}xx`).expect(401);
  });

  it('rejects a token signed with the refresh secret, which is a different key', async () => {
    await getProtected(forgeToken({ secret: config.getOrThrow<string>('REFRESH_TOKEN_SECRET'), expiresIn: '15m' })).expect(401);
  });

  it('rejects a malformed Authorization header', async () => {
    await request(server).get('/api/probe/protected').set('Authorization', accessToken).expect(401);
  });

  it('lets a @Public() route through without a token', async () => {
    await request(server).get('/api/probe/open').expect(200, { reached: true });
  });

  it('still lets the health check through, since its controller is @Public()', async () => {
    await request(server).get('/api/health').expect(200);
  });
});

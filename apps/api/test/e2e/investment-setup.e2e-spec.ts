import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Investment setup API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  const password = 'correct horse battery staple';
  const emails = ['investment-setup.e2e@family-budget.test', 'investment-setup.e2e.other@family-budget.test'];
  const call = (method: 'get' | 'post' | 'patch', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);
  const clearSetup = async () => {
    const where = { user: { email: { in: emails } } };
    await prisma.assetListing.deleteMany({ where });
    await prisma.instrument.deleteMany({ where });
    await prisma.financialInstitution.deleteMany({ where });
  };

  beforeAll(async () => {
    app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    const passwordHash = await app.get(HashService).hash(password);
    await Promise.all(
      emails.map((email) => prisma.user.upsert({ where: { email }, create: { email, name: 'Investment setup E2E', passwordHash }, update: { passwordHash } })),
    );
    const sessions = await Promise.all(
      emails.map(async (email) => ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken),
    );
    [token, otherToken] = [sessions[0]!, sessions[1]!];
  });

  beforeEach(async () => {
    await clearSetup();
  });

  afterAll(async () => {
    await clearSetup();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('creates, orders and deactivates institutions for only the authenticated user', async () => {
    await call('post', '/financial-institutions').send({ name: 'Kraken', kind: 'EXCHANGE', sortOrder: 1 }).expect(201);
    const bank = (await call('post', '/financial-institutions').send({ name: 'Banco Invest', kind: 'BANK' }).expect(201)).body as { id: string };
    await call('patch', `/financial-institutions/${bank.id}/deactivate`).expect(200);

    await expect(call('get', '/financial-institutions').expect(200)).resolves.toMatchObject({ body: [{ name: 'Kraken', kind: 'EXCHANGE' }] });
    await expect(call('get', '/financial-institutions?includeInactive=true', otherToken).expect(200)).resolves.toMatchObject({ body: [] });
  });

  it('keeps asset listing market identities separate and rejects inactive instruments for a new listing', async () => {
    const eur = (await call('post', '/instruments').send({ name: 'Euro', code: 'EUR', type: 'FIAT', displayPrecision: 2 }).expect(201)).body as { id: string };
    const etf = (await call('post', '/instruments').send({ name: 'Vanguard FTSE All-World', code: 'VWCE', type: 'ETF', displayPrecision: 4 }).expect(201))
      .body as { id: string };
    await call('post', '/asset-listings')
      .send({ instrumentId: etf.id, quoteInstrumentId: eur.id, market: 'Xetra', ticker: 'VWCE', isin: 'IE00BK5BQT80' })
      .expect(201);
    await call('post', '/asset-listings').send({ instrumentId: etf.id, quoteInstrumentId: eur.id, market: 'LSE', ticker: 'VWRP' }).expect(201);
    await call('patch', `/instruments/${etf.id}/deactivate`).expect(200);

    await expect(call('get', '/asset-listings').expect(200)).resolves.toMatchObject({ body: [] });
    await expect(call('get', '/asset-listings?includeInactive=true').expect(200)).resolves.toMatchObject({
      body: [
        { market: 'LSE', ticker: 'VWRP', isActive: false },
        { market: 'Xetra', ticker: 'VWCE', isActive: false },
      ],
    });
    await call('post', '/asset-listings').send({ instrumentId: etf.id, quoteInstrumentId: eur.id, market: 'Euronext', ticker: 'VWCE' }).expect(400);
  });
});

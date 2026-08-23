import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type CsvImportModelDto } from '../../src/modules/csv-import-models/dto/csv-import-model.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CSV import models API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let otherToken: string;
  let userId: string;

  const password = 'correct horse battery staple';
  const emails = ['csv-import-models.api.e2e@family-budget.test', 'csv-import-models.api.e2e.other@family-budget.test'];
  const authed = (method: 'get' | 'post' | 'delete', path: string, as = token): request.Test =>
    request(server)[method](`/api${path}`).set('Authorization', `Bearer ${as}`);
  const validBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    name: 'Millennium',
    headerLineCount: 1,
    separator: ';',
    dateHeader: 'Date',
    descriptionHeader: 'Description',
    amountHeader: 'Amount',
    ...overrides,
  });
  const create = async (body = validBody(), as = token): Promise<CsvImportModelDto> =>
    (await authed('post', '/csv-import-models', as).send(body).expect(201)).body as CsvImportModelDto;
  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email: { in: emails } } } });
    await prisma.csvImportModel.deleteMany({ where: { user: { email: { in: emails } } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    const passwordHash = await app.get(HashService).hash(password);
    for (const email of emails) {
      await prisma.user.upsert({ where: { email }, create: { email, name: 'CSV Models E2E', passwordHash }, update: { passwordHash } });
    }
    const [session, otherSession] = await Promise.all(
      emails.map(async (email) => (await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto),
    );
    token = session!.accessToken;
    otherToken = otherSession!.accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email: emails[0]! }, select: { id: true } })).id;
  });

  beforeEach(removeFixtures);

  afterAll(async () => {
    await removeFixtures();
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('requires authentication', async () => {
    await request(server).get('/api/csv-import-models').expect(401);
    await request(server).post('/api/csv-import-models').send(validBody()).expect(401);
  });

  it('creates and lists models in name order without exposing userId', async () => {
    await create(validBody({ name: 'Zulu' }));
    const created = await create(validBody({ name: '  Alpha  ', separator: '\t' }));

    expect(created).toMatchObject({
      name: 'Alpha',
      separator: '\t',
      headerLineCount: 1,
      dateHeader: 'Date',
      descriptionHeader: 'Description',
      amountHeader: 'Amount',
    });
    expect(created).not.toHaveProperty('userId');
    await expect(authed('get', '/csv-import-models').expect(200)).resolves.toMatchObject({ body: [{ name: 'Alpha' }, { name: 'Zulu' }] });
  });

  it('rejects duplicate names case-insensitively, but permits the same name for another user', async () => {
    await create();
    await authed('post', '/csv-import-models')
      .send(validBody({ name: 'millennium' }))
      .expect(409);
    await expect(create(validBody(), otherToken)).resolves.toMatchObject({ name: 'Millennium' });
  });

  it.each([
    ['empty name', { name: ' ' }],
    ['long name', { name: 'x'.repeat(101) }],
    ['zero header lines', { headerLineCount: 0 }],
    ['too many header lines', { headerLineCount: 101 }],
    ['fractional header lines', { headerLineCount: 1.5 }],
    ['unsupported separator', { separator: '|' }],
    ['empty date header', { dateHeader: ' ' }],
    ['empty description header', { descriptionHeader: ' ' }],
    ['empty amount header', { amountHeader: ' ' }],
  ])('rejects %s', async (_name, overrides) => {
    await authed('post', '/csv-import-models').send(validBody(overrides)).expect(400);
  });

  it('hides another user’s model and rejects deleting it', async () => {
    const foreign = await create(validBody(), otherToken);

    await expect(authed('get', '/csv-import-models').expect(200)).resolves.toMatchObject({ body: [] });
    await authed('delete', `/csv-import-models/${foreign.id}`).expect(404);
  });

  it('deletes a model without changing transactions', async () => {
    const model = await create();
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: 'INCOME',
        amount: 1_000,
        date: new Date('2026-08-23'),
        referenceMonth: new Date('2026-08-01'),
        description: 'Already imported',
      },
    });

    await authed('delete', `/csv-import-models/${model.id}`).expect(204);
    await authed('delete', `/csv-import-models/${model.id}`).expect(404);
    await expect(prisma.transaction.findUnique({ where: { id: transaction.id } })).resolves.toMatchObject({ id: transaction.id });
  });
});

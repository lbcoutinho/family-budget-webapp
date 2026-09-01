import { type Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { type CsvImportResultDto } from '../../src/modules/csv-import/dto/csv-import-result.dto';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('CSV import API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let accountId: string;
  let otherAccountId: string;
  let modelId: string;
  let categoryId: string;
  let subcategoryId: string;

  const email = 'csv-import.api.e2e@family-budget.test';
  const password = 'correct horse battery staple';
  const authed = (path: string): request.Test => request(server).post(`/api${path}`).set('Authorization', `Bearer ${token}`);
  const csv = (rows: string): Buffer => Buffer.from(`Date;Description;Amount\n${rows}`);
  const importFile = (path: string, rows: string, selectedLines?: number[]): request.Test => {
    const form = authed(path) as request.Test & { field(name: string, value: string | number): request.Test };
    form.field('modelId', modelId);
    form.field('accountId', accountId);
    if (selectedLines !== undefined) form.field('selectedLines', JSON.stringify(selectedLines));
    return form.attach('file', csv(rows), 'statement.csv');
  };

  const createHistory = async (data: Record<string, unknown>): Promise<void> => {
    await prisma.transaction.create({
      data: {
        userId,
        accountId,
        date: new Date('2026-07-01'),
        referenceMonth: new Date('2026-07-01'),
        settlementDate: new Date('2026-07-01'),
        description: 'history',
        amount: 100,
        type: 'EXPENSE',
        status: 'CONFIRMED',
        ...data,
      },
    });
  };

  const removeFixtures = async (): Promise<void> => {
    await prisma.transaction.deleteMany({ where: { user: { email } } });
    await prisma.csvImportModel.deleteMany({ where: { user: { email } } });
    await prisma.account.deleteMany({ where: { user: { email } } });
    await prisma.category.deleteMany({ where: { user: { email } } });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);

    const passwordHash = await app.get(HashService).hash(password);
    await prisma.user.upsert({ where: { email }, create: { email, name: 'CSV Import E2E', passwordHash }, update: { passwordHash } });
    token = ((await request(server).post('/api/auth/login').send({ email, password }).expect(200)).body as SessionDto).accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
  });

  beforeEach(async () => {
    await removeFixtures();
    const [account, otherAccount, category] = await Promise.all([
      prisma.account.create({ data: { userId, name: 'Checking' } }),
      prisma.account.create({ data: { userId, name: 'Savings' } }),
      prisma.category.create({ data: { userId, name: 'Food', kind: 'EXPENSE' } }),
    ]);
    accountId = account.id;
    otherAccountId = otherAccount.id;
    categoryId = category.id;
    subcategoryId = (await prisma.category.create({ data: { userId, parentId: categoryId, name: 'Groceries', kind: 'EXPENSE' } })).id;
    modelId = (
      await prisma.csvImportModel.create({
        data: { userId, name: 'Bank', headerLineCount: 1, separator: ';', dateHeader: 'Date', descriptionHeader: 'Description', amountHeader: 'Amount' },
      })
    ).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await prisma.user.delete({ where: { email } });
    await app.close();
  });

  it('suggests an active unanimous pair in preview and persists it as a draft', async () => {
    await createHistory({ description: '  Corner   Market ', categoryId, subcategoryId });

    const preview = (await importFile('/csv-import/preview', '02-08-2026;corner market;-10.00\n').expect(201)).body as CsvImportResultDto;
    expect(preview.new).toEqual([
      expect.objectContaining({
        suggestedCategoryId: categoryId,
        suggestedCategoryName: 'Food',
        suggestedSubcategoryId: subcategoryId,
        suggestedSubcategoryName: 'Groceries',
      }),
    ]);

    await importFile('/csv-import/confirm', '02-08-2026;corner market;-10.00\n', [2]).expect(201);
    await expect(prisma.transaction.findFirstOrThrow({ where: { accountId, description: 'corner market' } })).resolves.toMatchObject({
      status: 'DRAFT',
      source: 'IMPORT_CSV',
      categoryId,
      subcategoryId,
    });
  });

  it('leaves suggestions empty for unsafe or irrelevant history', async () => {
    const conflictingCategory = await prisma.category.create({ data: { userId, name: 'Income', kind: 'INCOME' } });
    const conflictingSubcategory = await prisma.category.create({ data: { userId, parentId: conflictingCategory.id, name: 'Bonus', kind: 'INCOME' } });
    const inactiveCategory = await prisma.category.create({ data: { userId, name: 'Retired', kind: 'EXPENSE', isActive: false } });
    const inactiveSubcategory = await prisma.category.create({ data: { userId, parentId: inactiveCategory.id, name: 'Old', kind: 'EXPENSE' } });

    await Promise.all([
      createHistory({ description: 'Conflict', categoryId, subcategoryId }),
      createHistory({ description: ' conflict ', type: 'INCOME', categoryId: conflictingCategory.id, subcategoryId: conflictingSubcategory.id }),
      createHistory({ description: 'Draft only', status: 'DRAFT', categoryId, subcategoryId }),
      createHistory({ description: 'Other account', accountId: otherAccountId, categoryId, subcategoryId }),
      createHistory({ description: 'Partial', categoryId }),
      createHistory({ description: 'Partial', categoryId, subcategoryId }),
      createHistory({ description: 'Inactive', categoryId: inactiveCategory.id, subcategoryId: inactiveSubcategory.id }),
      createHistory({ description: 'Café', categoryId, subcategoryId }),
      createHistory({ description: 'Coffee!', categoryId, subcategoryId }),
    ]);

    const preview = (
      await importFile(
        '/csv-import/preview',
        '02-08-2026;CONFLICT;-10.00\n03-08-2026;Draft only;-10.00\n04-08-2026;Other account;-10.00\n05-08-2026;Partial;-10.00\n06-08-2026;Inactive;-10.00\n07-08-2026;Cafe;-10.00\n08-08-2026;Coffee;-10.00\n',
      ).expect(201)
    ).body as CsvImportResultDto;

    expect(preview.new.map((row) => row.suggestedCategoryId)).toEqual([undefined, undefined, undefined, categoryId, undefined, undefined, undefined]);
    expect(preview.new[3]?.suggestedSubcategoryId).toBe(subcategoryId);
  });
});

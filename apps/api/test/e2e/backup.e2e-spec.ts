import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { type Server } from 'node:http';
import { PassThrough } from 'node:stream';

import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { type SessionDto } from '../../src/modules/auth/dto/session.dto';
import { HashService } from '../../src/modules/auth/hash.service';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));

class FakeChildProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly kill = jest.fn();
}

describe('Database backup (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let adminToken: string;
  let otherToken: string;
  let completeDump = true;
  let resolveDumpStarted: (() => void) | undefined;

  const adminEmail = 'backup.admin@family-budget.test';
  const otherEmail = 'backup.other@family-budget.test';
  const password = 'correct horse battery staple';
  const spawn = childProcess.spawn as jest.MockedFunction<typeof childProcess.spawn>;
  beforeAll(async () => {
    spawn.mockImplementation((_command, args) => {
      const child = new FakeChildProcess();

      process.nextTick(() => {
        if (args[0] === '--version') {
          child.stdout.end('pg_dump (PostgreSQL) 16.4\n');
          child.emit('close', 0);
          return;
        }

        resolveDumpStarted?.();
        if (completeDump) {
          child.stdout.end('dump');
          child.emit('close', 0);
        }
      });

      return child as unknown as childProcess.ChildProcess;
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
    prisma = app.get(PrismaService);
    app.get(ConfigService).set('ADMIN_EMAIL', adminEmail);

    const passwordHash = await app.get(HashService).hash(password);
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: 'Backup admin', passwordHash },
      update: { name: 'Backup admin', passwordHash },
    });
    await prisma.user.upsert({
      where: { email: otherEmail },
      create: { email: otherEmail, name: 'Backup other', passwordHash },
      update: { name: 'Backup other', passwordHash },
    });

    adminToken = ((await request(server).post('/api/auth/login').send({ email: adminEmail, password })).body as SessionDto).accessToken;
    otherToken = ((await request(server).post('/api/auth/login').send({ email: otherEmail, password })).body as SessionDto).accessToken;
  });

  afterAll(async () => {
    if (app !== undefined) {
      await prisma.user.deleteMany({ where: { email: { in: [adminEmail, otherEmail] } } });
      await app.close();
    }
    spawn.mockReset();
  });

  it('streams a custom dump attachment to the administrator and rejects other users', async () => {
    await request(server).get('/api/backups/database').set('Authorization', `Bearer ${otherToken}`).expect(403);

    const response = await request(server).get('/api/backups/database').set('Authorization', `Bearer ${adminToken}`).expect(200);

    expect(response.headers['content-type']).toContain('application/octet-stream');
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="family-budget-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.dump"$/);
    expect(response.body).toEqual(Buffer.from('dump'));
  });

  it('holds domain writes but not authentication while a backup is running', async () => {
    completeDump = false;
    const dumpStarted = new Promise<void>((resolve) => {
      resolveDumpStarted = resolve;
    });
    const download = request(server)
      .get('/api/backups/database')
      .set('Authorization', `Bearer ${adminToken}`)
      .then((response) => response);

    try {
      await dumpStarted;
      await request(server).post('/api/accounts').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Blocked account', type: 'CHECKING' }).expect(503);
      await request(server).post('/api/auth/login').send({ email: adminEmail, password }).expect(200);
    } finally {
      completeDump = true;
      resolveDumpStarted = undefined;
      const dump = spawn.mock.results.at(-1)?.value as unknown as FakeChildProcess;
      dump.stdout.end('dump');
      dump.emit('close', 0);
    }

    expect((await download).status).toBe(200);
  });
});

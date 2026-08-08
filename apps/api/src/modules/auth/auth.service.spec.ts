import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';

import { AuthService, type JwtPayload } from './auth.service';
import { HashService } from './hash.service';

/** The environment the service reads. Short lifetimes so an expiry can be asserted, not waited for. */
const ENVIRONMENT = {
  JWT_SECRET: 'access-secret',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_SECRET: 'refresh-secret',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
} as const;

const STORED_USER = {
  id: '11111111-2222-3333-4444-555555555555',
  email: 'person@example.com',
  name: 'person',
  locale: 'pt-BR',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;
  let findFirst: jest.Mock;
  let findUnique: jest.Mock;
  let verify: jest.Mock;

  beforeEach(async () => {
    findFirst = jest.fn();
    findUnique = jest.fn();
    // Hashing is mocked throughout: argon2 costs ~100 ms per call by design, and what is under
    // test here is the decision made from its answer, not the derivation itself.
    verify = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: { user: { findFirst, findUnique } } },
        { provide: HashService, useValue: { verify } },
        { provide: ConfigService, useValue: { getOrThrow: (key: keyof typeof ENVIRONMENT) => ENVIRONMENT[key] } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
  });

  describe('validateUser', () => {
    it('returns the account when the password matches, without its hash', async () => {
      findFirst.mockResolvedValue(STORED_USER);
      verify.mockResolvedValue(true);

      const user = await service.validateUser('person@example.com', 'correct');

      expect(user).toEqual({ id: STORED_USER.id, email: STORED_USER.email, name: STORED_USER.name, locale: STORED_USER.locale });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('returns null when the password is wrong', async () => {
      findFirst.mockResolvedValue(STORED_USER);
      verify.mockResolvedValue(false);

      await expect(service.validateUser('person@example.com', 'wrong')).resolves.toBeNull();
    });

    it('returns null for an unknown address, without hashing anything', async () => {
      findFirst.mockResolvedValue(null);

      await expect(service.validateUser('stranger@example.com', 'whatever')).resolves.toBeNull();
      expect(verify).not.toHaveBeenCalled();
    });

    it('looks the address up case-insensitively and trimmed', async () => {
      findFirst.mockResolvedValue(STORED_USER);
      verify.mockResolvedValue(true);

      await service.validateUser('  Person@Example.com  ', 'correct');

      expect(findFirst).toHaveBeenCalledWith({ where: { email: { equals: 'Person@Example.com', mode: 'insensitive' } } });
    });

    it('compares through the hash service, never by string equality', async () => {
      findFirst.mockResolvedValue(STORED_USER);
      verify.mockResolvedValue(true);

      await service.validateUser('person@example.com', 'correct');

      expect(verify).toHaveBeenCalledWith(STORED_USER.passwordHash, 'correct');
    });
  });

  describe('issueSession', () => {
    const user = { id: STORED_USER.id, email: STORED_USER.email, name: STORED_USER.name, locale: STORED_USER.locale };

    it('signs an access token carrying the account id as `sub`', () => {
      const session = service.issueSession(user);

      const payload = jwt.verify<JwtPayload>(session.accessToken, { secret: ENVIRONMENT.JWT_SECRET });

      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe(user.email);
      expect(session.user).toEqual(user);
    });

    it('signs the access token with the access secret, so a refresh secret cannot verify it', () => {
      const { accessToken } = service.issueSession(user);

      expect(() => {
        jwt.verify(accessToken, { secret: ENVIRONMENT.REFRESH_TOKEN_SECRET });
      }).toThrow();
    });
  });

  describe('issueRefreshToken', () => {
    const user = { id: STORED_USER.id, email: STORED_USER.email, name: STORED_USER.name, locale: STORED_USER.locale };

    it('signs with the refresh secret and reports the expiry from the token itself', () => {
      const { token, expiresAt } = service.issueRefreshToken(user);

      const payload = jwt.verify<JwtPayload & { exp: number }>(token, { secret: ENVIRONMENT.REFRESH_TOKEN_SECRET });

      expect(payload.sub).toBe(user.id);
      expect(expiresAt.getTime()).toBe(payload.exp * 1000);
      // 7 days, give or take the second the test spent running.
      expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    });
  });

  describe('refreshSession', () => {
    const user = { id: STORED_USER.id, email: STORED_USER.email, name: STORED_USER.name, locale: STORED_USER.locale };

    it('issues a new session for the account named by a valid token', async () => {
      findUnique.mockResolvedValue(user);

      const { token } = service.issueRefreshToken(user);
      const session = await service.refreshSession(token);

      expect(session.user).toEqual(user);
      expect(jwt.verify<JwtPayload>(session.accessToken, { secret: ENVIRONMENT.JWT_SECRET }).sub).toBe(user.id);
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not a token', 'nonsense'],
    ])('rejects a %s cookie', async (_label, token) => {
      await expect(service.refreshSession(token)).rejects.toThrow('Invalid session');
    });

    it('rejects a token signed with the access secret', async () => {
      const accessToken = service.issueSession(user).accessToken;

      await expect(service.refreshSession(accessToken)).rejects.toThrow('Invalid session');
    });

    it('rejects an expired token', async () => {
      const expired = jwt.sign({ sub: user.id, email: user.email }, { secret: ENVIRONMENT.REFRESH_TOKEN_SECRET, expiresIn: '-1s' });

      await expect(service.refreshSession(expired)).rejects.toThrow('Invalid session');
    });

    it('rejects a valid token whose account no longer exists', async () => {
      findUnique.mockResolvedValue(null);

      const { token } = service.issueRefreshToken(user);

      await expect(service.refreshSession(token)).rejects.toThrow('Invalid session');
    });
  });
});

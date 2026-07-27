import { HashService } from './hash.service';

/**
 * Unit coverage for {@link HashService} (M2-T02). Real argon2 calls, not mocks: the point of the
 * service is the derivation itself, and mocking it would assert nothing. Each hash costs roughly
 * a tenth of a second by design, hence the raised timeouts.
 */
describe('HashService', () => {
  const service = new HashService();
  const password = 'correct horse battery staple';

  // argon2 is deliberately slow; the default 5 s leaves no headroom on a loaded CI runner.
  jest.setTimeout(30_000);

  it('returns a hash that is not the password', async () => {
    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    expect(hash).not.toContain(password);
  });

  it('produces an argon2id PHC string', async () => {
    const hash = await service.hash(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('produces a different hash every time, because the salt is random', async () => {
    const [first, second] = await Promise.all([service.hash(password), service.hash(password)]);

    expect(first).not.toBe(second);
    await expect(service.verify(first, password)).resolves.toBe(true);
    await expect(service.verify(second, password)).resolves.toBe(true);
  });

  it('verifies the correct password', async () => {
    const hash = await service.hash(password);

    await expect(service.verify(hash, password)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash(password);

    await expect(service.verify(hash, 'Correct horse battery staple')).resolves.toBe(false);
    await expect(service.verify(hash, '')).resolves.toBe(false);
  });

  it('answers false for a malformed hash instead of throwing', async () => {
    await expect(service.verify('not-a-phc-string', password)).resolves.toBe(false);
    await expect(service.verify('', password)).resolves.toBe(false);
  });
});

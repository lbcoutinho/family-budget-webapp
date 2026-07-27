import { toDemoEmail } from './demo-email';

describe('toDemoEmail', () => {
  it.each([
    ['person@example.com', 'person+demo@example.com'],
    ['ana.silva@example.com', 'ana.silva+demo@example.com'],
    ["o'brien@example.co.uk", "o'brien+demo@example.co.uk"],
    ['user_name-1@mail.example.com', 'user_name-1+demo@mail.example.com'],
    // An address that already carries a sub-address keeps it: still the same mailbox, still a
    // distinct login.
    ['person+budget@example.com', 'person+budget+demo@example.com'],
    // Only the last `@` separates the domain.
    ['"odd@local"@example.com', '"odd@local"+demo@example.com'],
  ])('derives the +demo sub-address of %s', (email, expected) => {
    expect(toDemoEmail(email)).toBe(expected);
  });

  it('ignores surrounding whitespace, which an environment file collects easily', () => {
    expect(toDemoEmail('  person@example.com  ')).toBe('person+demo@example.com');
  });

  it.each(['', '   ', 'person', '@example.com', 'person@', 'person.example.com'])('rejects %p, which is not an email address', (email) => {
    expect(() => toDemoEmail(email)).toThrow(/not a valid email address/);
  });
});

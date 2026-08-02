import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client';
import { HashService } from '../src/modules/auth/hash.service';
import { toDemoEmail } from '../src/modules/users/demo-email';

/**
 * Database seed (M2-T02). The application is single-user and has no sign-up screen (ADR-0006),
 * so the accounts that can log in are the ones this script writes:
 *
 *   - the **owner**, at `SEED_USER_EMAIL` / `SEED_USER_PASSWORD`;
 *   - a **demo** account at the `+demo` sub-address of the same mailbox, with its own
 *     `SEED_DEMO_USER_PASSWORD`, so the application can be shown to someone without exposing the
 *     real data.
 *
 * Both users also get the two sample accounts of M3-T01, so a fresh database has something to
 * record transactions against.
 *
 * Run with `pnpm --filter api db:seed`. Prisma 7 invokes it through `migrations.seed` in
 * `prisma.config.ts`; the `prisma.seed` key in package.json is gone (ADR-0017).
 *
 * The script is idempotent: every account is written with `upsert` keyed on the email, so a
 * second run updates the two rows instead of failing on the unique constraint. The password hash
 * is re-derived on each run, which both keeps the accounts in step with a changed `.env` and
 * means the stored hash differs every time — argon2 salts at random.
 */

/** The three environment values the seed needs. Passed in explicitly so tests never rely on `.env`. */
export interface SeedCredentials {
  /** The owner's address, i.e. `SEED_USER_EMAIL`. The demo address is derived from it. */
  email: string;
  /** The owner's password, i.e. `SEED_USER_PASSWORD`. */
  password: string;
  /** The demo account's password, i.e. `SEED_DEMO_USER_PASSWORD`. */
  demoPassword: string;
}

/** What the seed wrote, for logging and for assertions. Never carries a password or a hash. */
export interface SeededUser {
  id: string;
  email: string;
  name: string;
  /** `false` when the row already existed and was updated — i.e. on every run after the first. */
  created: boolean;
}

/** Environment variables read by this script. They are seed-only: the API never sees them. */
const REQUIRED_VARIABLES = ['SEED_USER_EMAIL', 'SEED_USER_PASSWORD', 'SEED_DEMO_USER_PASSWORD'] as const;

/**
 * Display name of the owner: the mailbox part of the address, with any existing sub-address
 * dropped (`ana.silva+budget@example.com` → `ana.silva`). Deliberately derived rather than
 * configured — a fourth seed variable to carry a cosmetic string is not worth the drift, and the
 * name is the one field a later profile screen can edit.
 */
function ownerNameFrom(email: string): string {
  const localPart = email.slice(0, email.lastIndexOf('@'));
  const [mailbox] = localPart.split('+');

  return mailbox && mailbox.length > 0 ? mailbox : localPart;
}

/**
 * Write one account, keyed on its email. Both branches set `passwordHash`, so an existing row is
 * brought in line with the current environment instead of keeping a stale password.
 */
async function upsertUser(prisma: PrismaClient, email: string, name: string, passwordHash: string): Promise<SeededUser> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash },
    select: { id: true, email: true, name: true },
  });

  return { ...user, created: existing === null };
}

/**
 * Create or refresh the owner and demo accounts.
 *
 * Takes the client and the credentials as arguments rather than reading `process.env`, so the
 * integration test drives the same code path against the test database with its own fixtures.
 */
export async function seedUsers(prisma: PrismaClient, credentials: SeedCredentials): Promise<{ owner: SeededUser; demo: SeededUser }> {
  const email = credentials.email.trim();
  const demoEmail = toDemoEmail(email);

  if (credentials.password === credentials.demoPassword) {
    // The demo password is meant to be handed out; sharing it with the owner's would hand out
    // the owner's login too. Caught here rather than in env validation because the seed is the
    // only thing that reads either value.
    throw new Error('SEED_DEMO_USER_PASSWORD must differ from SEED_USER_PASSWORD');
  }

  const hashService = new HashService();

  // Hashed independently, so neither account's hash reveals anything about the other's password.
  const [passwordHash, demoPasswordHash] = await Promise.all([hashService.hash(credentials.password), hashService.hash(credentials.demoPassword)]);

  const owner = await upsertUser(prisma, email, ownerNameFrom(email), passwordHash);
  const demo = await upsertUser(prisma, demoEmail, 'Demo', demoPasswordHash);

  for (const user of [owner, demo]) {
    await seedAccounts(prisma, user.id);
  }

  return { owner, demo };
}

/**
 * The sample accounts every seeded user starts with (M3-T01). Same names the prototypes use, so
 * the screens are read against the data they were drawn with. `initialBalance` is in cents.
 */
const SAMPLE_ACCOUNTS = [
  { name: 'Millennium', initialBalance: 150_000, sortOrder: 1 },
  { name: 'Revolut', initialBalance: 28_340, sortOrder: 2 },
] as const;

/**
 * Give a user the sample accounts. Idempotent through the `(userId, name)` unique constraint, and
 * `update: {}` so a second run never resets a balance the user has since edited.
 */
export async function seedAccounts(prisma: PrismaClient, userId: string): Promise<void> {
  for (const account of SAMPLE_ACCOUNTS) {
    await prisma.account.upsert({
      where: { userId_name: { userId, name: account.name } },
      create: { userId, ...account },
      update: {},
    });
  }
}

/**
 * Read the seed credentials off an environment object, naming every missing variable at once so
 * a half-filled `.env` is fixed in one pass.
 */
function readCredentials(env: NodeJS.ProcessEnv): SeedCredentials {
  const missing = REQUIRED_VARIABLES.filter((name) => (env[name] ?? '').trim().length === 0);

  if (missing.length > 0) {
    throw new Error(`Cannot seed: missing environment variable(s) ${missing.join(', ')}. See .env.example.`);
  }

  return {
    email: env.SEED_USER_EMAIL ?? '',
    password: env.SEED_USER_PASSWORD ?? '',
    demoPassword: env.SEED_DEMO_USER_PASSWORD ?? '',
  };
}

async function main(): Promise<void> {
  // Prisma 7 no longer loads `.env` itself (ADR-0017), and this script runs as its own process.
  // Same lookup order as prisma.config.ts: the workspace's own file first, then the shared root.
  loadEnv({ path: ['.env', '../../.env'], quiet: true });

  const credentials = readCredentials(process.env);
  const connectionString = process.env.DATABASE_URL ?? '';

  if (connectionString.length === 0) {
    throw new Error('Cannot seed: missing environment variable DATABASE_URL. See .env.example.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const { owner, demo } = await seedUsers(prisma, credentials);

    // Emails and ids only. A password must never reach the terminal or a CI log.
    for (const account of [owner, demo]) {
      // eslint-disable-next-line no-console
      console.log(`${account.created ? 'Created' : 'Updated'} user ${account.email} (${account.id})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Only when run as a script. The integration test imports `seedUsers` from this module and must
// not trigger a run against whatever database `.env` happens to point at.
if (require.main === module) {
  void main();
}

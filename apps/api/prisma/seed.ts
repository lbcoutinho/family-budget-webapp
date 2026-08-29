import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadEnv } from 'dotenv';

import { CategoryKind, type Prisma, PrismaClient } from '../src/generated/prisma/client';
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
 * **Sample data goes to the demo user only, never to the owner.** The owner's database holds real
 * money; the demo user is the one that has to look populated. M3-T01 adds the first of it — two
 * sample accounts — and M3-T03 the sample category tree.
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

  // Demo only. The owner's database holds real money; sample rows never go into it.
  await seedAccounts(prisma, demo.id);
  await seedCategories(prisma, demo.id);
  await seedCashboxes(prisma, demo.id);
  await seedTransactions(prisma, demo.id);

  return { owner, demo };
}

/**
 * The sample accounts the demo user starts with (M3-T01). Same names the prototypes use, so the
 * screens are read against the data they were drawn with. `initialBalance` is in cents.
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
 * The sample cashboxes the demo user starts with (M3-T09). Same names the prototype uses
 * (`prototypes/approved/05-cashboxes.html`). `targetAmount` is in cents; `null` means the
 * cashbox simply accumulates with no goal. No balance field — balances are always computed,
 * never stored on this model.
 */
const SAMPLE_CASHBOXES = [
  { name: 'Férias 2027', description: 'Duas semanas na Grécia, em julho', targetAmount: 500_000, isActive: true, sortOrder: 1 },
  { name: 'Obras', description: 'Cozinha e casa de banho', targetAmount: null, isActive: true, sortOrder: 2 },
  { name: 'Carro novo', description: 'Encerrada — o carro foi comprado em maio', targetAmount: null, isActive: false, sortOrder: 3 },
] as const;

/**
 * Give a user the sample cashboxes. Idempotent through the `(userId, name)` unique constraint,
 * and `update: {}` so a second run never resets a row the user has since edited.
 */
export async function seedCashboxes(prisma: PrismaClient, userId: string): Promise<void> {
  for (const cashbox of SAMPLE_CASHBOXES) {
    await prisma.cashbox.upsert({
      where: { userId_name: { userId, name: cashbox.name } },
      create: { userId, ...cashbox },
      update: {},
    });
  }
}

/**
 * The sample category tree the demo user starts with (M3-T03). Names, kinds and colours are the
 * ones the prototypes are drawn with (`prototypes/approved/06-month.html`), so a screen built
 * against this data looks like the picture it was approved from.
 *
 * Colours are the first five swatches of the palette (`--category-1..5` in
 * `apps/web/src/styles/index.css`), in the order the prototypes use them. Only roots carry one —
 * subcategories inherit their parent's in the charts.
 *
 * No automatic "Outros" subcategory here: that rule belongs to the categories service (M3-T04),
 * and hard-coding it now would fork the behaviour across two tickets.
 */
const SAMPLE_CATEGORIES = [
  { name: 'Moradia', kind: CategoryKind.EXPENSE, color: '#1f6f54', children: ['Renda', 'Água, luz e gás'] },
  { name: 'Transporte', kind: CategoryKind.EXPENSE, color: '#1f5aa8', children: ['Combustível', 'Seguro', 'Estacionamento'] },
  { name: 'Alimentação', kind: CategoryKind.EXPENSE, color: '#a85c1a', children: ['Supermercado', 'Restaurante'] },
  { name: 'Saúde', kind: CategoryKind.EXPENSE, color: '#a32c3d', children: [] },
  { name: 'Lazer', kind: CategoryKind.EXPENSE, color: '#7a45b5', children: ['Espetáculos'] },
  // Left without a colour on purpose: it is a normal state, and the income side of the reports
  // does not draw a category donut. `Outros` here (rather than an empty list) is what
  // `POST /categories` gives every new root automatically — hand-added since this script writes
  // categories directly and skips that service, and an INCOME transaction needs a subcategory.
  { name: 'Salário', kind: CategoryKind.INCOME, color: null, children: ['Outros'] },
] as const;

/**
 * Find a category by its natural key, or create it, returning its id either way.
 *
 * A `findFirst` rather than an `upsert` because roots are unique through the partial index
 * (`category_root_name_unique`), which Prisma cannot address in a `where` — and because
 * `parentId: null` in a compound unique key would compare as `NULL = NULL`, i.e. never match.
 * `findFirst` emits `IS NULL`, so the same call covers roots and subcategories.
 *
 * Existing rows are returned untouched, so a second run never resets a colour or a name the user
 * has since edited.
 */
async function findOrCreateCategory(prisma: PrismaClient, data: Prisma.CategoryUncheckedCreateInput): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { userId: data.userId, parentId: data.parentId ?? null, name: data.name },
    select: { id: true },
  });

  if (existing !== null) {
    return existing.id;
  }

  const created = await prisma.category.create({ data, select: { id: true } });

  return created.id;
}

/**
 * Give a user the sample category tree. Roots first, then their children — the self-referencing
 * foreign key needs the parent to exist, and `sortOrder` counts from 1 within each level.
 */
export async function seedCategories(prisma: PrismaClient, userId: string): Promise<void> {
  for (const [index, category] of SAMPLE_CATEGORIES.entries()) {
    const parentId = await findOrCreateCategory(prisma, {
      userId,
      name: category.name,
      kind: category.kind,
      color: category.color,
      sortOrder: index + 1,
    });

    for (const [childIndex, name] of category.children.entries()) {
      // A subcategory inherits its parent's kind: nothing under "Alimentação" is income.
      await findOrCreateCategory(prisma, { userId, parentId, name, kind: category.kind, sortOrder: childIndex + 1 });
    }
  }
}

/**
 * Sample transactions the demo user starts with (M4). Amounts are in cents. `account`/`category`/
 * `subcategory`/`cashbox` are the sample rows' names, resolved to ids at seed time rather than
 * hard-coded — the ids above are only stable within a single run.
 *
 * The two cashboxes tell different stories on purpose: `Férias 2027` only ever receives money, so
 * it ends the seed with a balance; `Obras` receives and then gives back the same total, so it ends
 * at zero — the two states M4-T10's summary cards need to be exercised against.
 */
const SAMPLE_TRANSACTIONS = [
  { type: 'INCOME', account: 'Millennium', category: 'Salário', subcategory: 'Outros', amount: 320_000, date: '2026-08-01', description: 'Salário' },
  { type: 'INCOME', account: 'Revolut', category: 'Salário', subcategory: 'Outros', amount: 45_000, date: '2026-08-05', description: 'Trabalho extra' },

  { type: 'EXPENSE', account: 'Millennium', category: 'Moradia', subcategory: 'Renda', amount: 90_000, date: '2026-08-01', description: 'Renda de agosto' },
  { type: 'EXPENSE', account: 'Millennium', category: 'Moradia', subcategory: 'Água, luz e gás', amount: 8_500, date: '2026-08-03', description: 'Fatura EDP' },
  { type: 'EXPENSE', account: 'Millennium', category: 'Transporte', subcategory: 'Combustível', amount: 6_000, date: '2026-08-04', description: 'Gasolina' },
  { type: 'EXPENSE', account: 'Millennium', category: 'Transporte', subcategory: 'Seguro', amount: 4_200, date: '2026-08-05', description: 'Seguro do carro' },
  {
    type: 'EXPENSE',
    account: 'Revolut',
    category: 'Transporte',
    subcategory: 'Estacionamento',
    amount: 1_500,
    date: '2026-08-06',
    description: 'Parque do centro',
  },
  {
    type: 'EXPENSE',
    account: 'Millennium',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    amount: 12_000,
    date: '2026-08-02',
    description: 'Compras da semana',
  },
  {
    type: 'EXPENSE',
    account: 'Millennium',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    amount: 9_800,
    date: '2026-08-09',
    description: 'Compras da semana',
  },
  { type: 'EXPENSE', account: 'Revolut', category: 'Alimentação', subcategory: 'Restaurante', amount: 3_500, date: '2026-08-07', description: 'Jantar fora' },
  { type: 'EXPENSE', account: 'Revolut', category: 'Lazer', subcategory: 'Espetáculos', amount: 5_000, date: '2026-08-08', description: 'Cinema' },
  { type: 'EXPENSE', account: 'Millennium', category: 'Lazer', subcategory: 'Espetáculos', amount: 2_200, date: '2026-08-10', description: 'Concerto' },

  {
    type: 'EXPENSE',
    account: 'Revolut',
    category: 'Lazer',
    subcategory: 'Espetáculos',
    amount: 7_500,
    date: '2026-08-12',
    description: 'Bilhetes de festival (por confirmar)',
    status: 'DRAFT',
  },

  { type: 'CASHBOX_IN', account: 'Millennium', cashbox: 'Férias 2027', amount: 40_000, date: '2026-08-01', description: 'Poupança de agosto' },
  { type: 'CASHBOX_IN', account: 'Revolut', cashbox: 'Férias 2027', amount: 25_000, date: '2026-08-08', description: 'Bónus de férias' },
  { type: 'CASHBOX_IN', account: 'Millennium', cashbox: 'Obras', amount: 50_000, date: '2026-08-02', description: 'Depósito para a obra' },
  { type: 'CASHBOX_IN', account: 'Revolut', cashbox: 'Obras', amount: 30_000, date: '2026-08-09', description: 'Reforço da obra' },
  { type: 'CASHBOX_OUT', account: 'Millennium', cashbox: 'Obras', amount: 50_000, date: '2026-08-05', description: 'Pagamento ao empreiteiro' },
  { type: 'CASHBOX_OUT', account: 'Revolut', cashbox: 'Obras', amount: 30_000, date: '2026-08-11', description: 'Compra de material' },
  {
    type: 'CASHBOX_TRANSFER',
    account: 'Millennium',
    cashbox: 'Férias 2027',
    destinationCashbox: 'Obras',
    amount: 15_000,
    date: '2026-08-13',
    description: 'Reforço da obra a partir das férias',
  },

  // July 2026: income equals expenses, month ends at a zero balance.
  { type: 'INCOME', account: 'Millennium', category: 'Salário', subcategory: 'Outros', amount: 320_000, date: '2026-07-01', description: 'Salário' },
  { type: 'EXPENSE', account: 'Millennium', category: 'Moradia', subcategory: 'Renda', amount: 90_000, date: '2026-07-01', description: 'Renda de julho' },
  {
    type: 'EXPENSE',
    account: 'Millennium',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    amount: 12_000,
    date: '2026-07-10',
    description: 'Compras da semana',
  },
  {
    type: 'EXPENSE',
    account: 'Millennium',
    category: 'Transporte',
    subcategory: 'Seguro',
    amount: 218_000,
    date: '2026-07-15',
    description: 'Reparação do carro',
  },
  {
    type: 'EXPENSE',
    account: 'Revolut',
    category: 'Alimentação',
    subcategory: 'Restaurante',
    amount: 4_200,
    date: '2026-07-20',
    description: 'Jantar de aniversário (por confirmar)',
    status: 'DRAFT',
  },

  // June 2026: income covers expenses plus a cashbox deposit, month ends at a zero balance.
  { type: 'INCOME', account: 'Millennium', category: 'Salário', subcategory: 'Outros', amount: 300_000, date: '2026-06-01', description: 'Salário' },
  { type: 'INCOME', account: 'Revolut', category: 'Salário', subcategory: 'Outros', amount: 50_000, date: '2026-06-05', description: 'Trabalho extra' },
  { type: 'EXPENSE', account: 'Millennium', category: 'Moradia', subcategory: 'Renda', amount: 90_000, date: '2026-06-01', description: 'Renda de junho' },
  {
    type: 'EXPENSE',
    account: 'Millennium',
    category: 'Alimentação',
    subcategory: 'Supermercado',
    amount: 60_000,
    date: '2026-06-10',
    description: 'Compras do mês',
  },
  { type: 'CASHBOX_IN', account: 'Millennium', cashbox: 'Férias 2027', amount: 200_000, date: '2026-06-15', description: 'Poupança de junho' },
] as const;

/**
 * Give a user the sample transactions. Skipped entirely once the user has any transaction — unlike
 * accounts/categories/cashboxes there is no natural per-row unique key to upsert on, so re-running
 * against a demo database that already has activity would just pile up duplicates.
 */
export async function seedTransactions(prisma: PrismaClient, userId: string): Promise<void> {
  const existing = await prisma.transaction.findFirst({ where: { userId }, select: { id: true } });

  if (existing !== null) {
    return;
  }

  const [accounts, cashboxes, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    prisma.cashbox.findMany({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
  ]);

  const accountId = (name: string): string => {
    const account = accounts.find((row) => row.name === name);
    if (account === undefined) throw new Error(`Seed transactions: unknown account "${name}"`);
    return account.id;
  };
  const cashboxId = (name: string): string => {
    const cashbox = cashboxes.find((row) => row.name === name);
    if (cashbox === undefined) throw new Error(`Seed transactions: unknown cashbox "${name}"`);
    return cashbox.id;
  };
  const categoryId = (name: string, parentId: string | null): string => {
    const category = categories.find((row) => row.name === name && row.parentId === parentId);
    if (category === undefined) throw new Error(`Seed transactions: unknown category "${name}"`);
    return category.id;
  };

  for (const transaction of SAMPLE_TRANSACTIONS) {
    const date = new Date(`${transaction.date}T00:00:00.000Z`);
    const referenceMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

    const category = 'category' in transaction ? categoryId(transaction.category, null) : null;

    await prisma.transaction.create({
      data: {
        userId,
        type: transaction.type,
        amount: transaction.amount,
        status: 'status' in transaction ? transaction.status : undefined,
        date,
        referenceMonth,
        settlementDate: date,
        description: transaction.description,
        accountId: accountId(transaction.account),
        categoryId: category,
        subcategoryId: 'subcategory' in transaction ? categoryId(transaction.subcategory, category) : null,
        cashboxId: 'cashbox' in transaction ? cashboxId(transaction.cashbox) : null,
        destinationCashboxId: 'destinationCashbox' in transaction ? cashboxId(transaction.destinationCashbox) : null,
        // Snapshotted at write time like the service does (ADR-0019) — without it the UI has no cashbox name.
        cashboxLabel: 'cashbox' in transaction ? transaction.cashbox : null,
        destinationCashboxLabel: 'destinationCashbox' in transaction ? transaction.destinationCashbox : null,
      },
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

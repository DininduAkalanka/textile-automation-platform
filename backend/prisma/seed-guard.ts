/**
 * Safety guard for the demo-data scripts (seed.ts, seed-history.ts,
 * clean-reset.ts).
 *
 * Those scripts write DEMO data: invented products, orders and reviews, and
 * test accounts whose default passwords are written in this repository.
 * clean-reset.ts also deletes every order and product first. Run against a
 * live shop by mistake, they would destroy real orders or publish an admin
 * login anyone could read from the code.
 *
 * So they run freely only against a local database. To seed a remote demo or
 * staging database on purpose, name that exact host:
 *
 *   ALLOW_DEMO_SEED=<database host> npm run seed
 *
 * and supply real passwords (SEED_ADMIN_PASSWORD, SEED_CUSTOMER_PASSWORD,
 * SEED_WORKER_PASSWORD): the in-code defaults are refused off this machine.
 */

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  // docker-compose service / container names
  'postgres',
  'textile_postgresdocker',
  'textile_qa_pg',
]);

function databaseHost(): string {
  const url = process.env.DATABASE_URL ?? '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function isLocalDatabase(): boolean {
  return LOCAL_HOSTS.has(databaseHost());
}

/** Throws unless the target database is local or explicitly allowed by host. */
export function assertSafeSeedTarget(script: string): void {
  if (isLocalDatabase()) return;
  const host = databaseHost() || '(unparseable DATABASE_URL)';
  if (process.env.ALLOW_DEMO_SEED === host) {
    console.warn(
      `⚠️  ${script}: writing DEMO data to remote database ${host} (ALLOW_DEMO_SEED matches).`,
    );
    return;
  }
  throw new Error(
    `${script} refused: DATABASE_URL points at "${host}", which is not a local database.\n` +
      'This script writes demo products, orders and test accounts' +
      (script === 'clean-reset'
        ? ' after DELETING all orders and products'
        : '') +
      '.\nIf this really is a demo/staging database, run again with ' +
      `ALLOW_DEMO_SEED=${host}`,
  );
}

/**
 * A seed account password: the environment variable if set; otherwise the
 * in-code default, which is accepted for a local database only.
 */
export function seedPassword(envName: string, localDefault: string): string {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) {
    if (fromEnv.length < 12) {
      throw new Error(`${envName} must be at least 12 characters.`);
    }
    return fromEnv;
  }
  if (isLocalDatabase()) return localDefault;
  throw new Error(
    `${envName} is required when seeding a non-local database: the default ` +
      'password is published in the repository.',
  );
}

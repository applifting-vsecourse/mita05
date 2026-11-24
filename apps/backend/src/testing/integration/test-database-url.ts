/**
 * The database the integration tests run against. It is wiped before every
 * test, so it must never be the dev database.
 *
 * Locally: a separate `quacker_test` database in the Docker Postgres from
 * `pnpm dev` (created on the first run). In CI: set TEST_DATABASE_URL.
 *
 * DATABASE_URL is deliberately ignored — it points at the dev database.
 */
const LOCAL_TEST_DATABASE_URL =
  'postgresql://quacker:quacker@localhost:5433/quacker_test';

export const getTestDatabaseUrl = (): string => {
  const url = process.env.TEST_DATABASE_URL || LOCAL_TEST_DATABASE_URL;
  const databaseName = new URL(url).pathname.replace(/^\//, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against "${databaseName}": ` +
        'the test database name must end with "_test", because every test wipes it.',
    );
  }
  return url;
};

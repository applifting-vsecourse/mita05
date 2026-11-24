import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { getTestDatabaseUrl } from './test-database-url';

/**
 * Runs once before all integration tests: brings the test database up to the
 * schema in prisma/migrations. `prisma migrate deploy` creates the database if
 * it doesn't exist yet.
 */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: join(__dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: getTestDatabaseUrl() },
    stdio: 'inherit',
  });
}

import { getTestDatabaseUrl } from './test-database-url';

// Runs in every test file before any app code is imported. The app reads its
// configuration from process.env (jest doesn't load .env), so this is the whole
// configuration the tests run with.
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET ??= 'integration_test_secret';
process.env.BACKEND_URL ??= 'http://localhost:4050';
process.env.FRONTEND_URL ??= 'http://localhost:3050';
process.env.SUPERADMIN_EMAIL ??= 'admin@example.com';
process.env.SUPERADMIN_PASSWORD ??= 'adminpassword';
// Belt and braces: the test app replaces the mailer with a recorder anyway.
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_HOST;

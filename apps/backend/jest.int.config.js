// Integration tests: real HTTP requests (supertest) to the whole Nest app,
// against a real Postgres. Files are named *.int-spec.ts; the unit test config
// in package.json matches only *.spec.ts, so the two never mix.
//
// Run with `pnpm backend test:int`. The script starts Node with
// --experimental-vm-modules: better-auth ships ES modules only, and on Node 24
// that flag lets jest require() them.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: './',
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
  testRegex: '\\.int-spec\\.ts$',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/src/testing/integration/global-setup.ts',
  setupFiles: ['<rootDir>/src/testing/integration/setup-env.ts'],
  // One shared database, wiped before each test: run files one at a time.
  maxWorkers: 1,
  testTimeout: 30000,
};

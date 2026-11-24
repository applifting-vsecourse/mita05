import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { EmailService } from '@/core/email/interfaces/email-service.interface';
import { PrismaService } from '@/core/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

export type SentEmail = { to: string; subject: string; html: string };

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  /** Emails the app sent (e.g. sign-up verification); nothing leaves the test. */
  sentEmails: SentEmail[];
  /** Supertest against the app's HTTP server, as a signed-out visitor. */
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
};

/** The whole Nest app, wired like main.ts, against the test database. */
export const createTestApp = async (): Promise<TestApp> => {
  const sentEmails: SentEmail[] = [];
  const recordingMailer: EmailService = {
    sendEmail: async (to, subject, html) => {
      sentEmails.push({ to, subject, html });
    },
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('EmailService')
    .useValue(recordingMailer)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    sentEmails,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
};

/**
 * Empties every table except Prisma's migration history, so each test starts
 * from an empty database.
 */
export const resetDatabase = async (prisma: PrismaService): Promise<void> => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list.join(', ')} RESTART IDENTITY CASCADE`,
  );
};

let userCounter = 0;

/**
 * Signs up a fresh user through BetterAuth and returns a supertest agent that
 * carries their session cookie, so requests made with it are signed in.
 */
export const signedInAgent = async (
  testApp: TestApp,
  overrides: { name?: string; username?: string } = {},
): Promise<ReturnType<typeof request.agent>> => {
  userCounter += 1;
  const username = overrides.username ?? `testduck${userCounter}`;
  const agent = request.agent(testApp.app.getHttpServer());
  await agent
    .post('/api/auth/sign-up/email')
    .send({
      email: `${username.toLowerCase()}@example.com`,
      password: 'password123',
      name: overrides.name ?? `Test Duck ${userCounter}`,
      username,
    })
    .expect(200);
  return agent;
};

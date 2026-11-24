import {
  createTestApp,
  resetDatabase,
  signedInAgent,
  TestApp,
} from '@/testing/integration/test-app';

describe('GET /api/quacks (integration)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('refuses a signed-out visitor with 401', async () => {
    await testApp.http().get('/api/quacks').expect(401);
  });

  it('returns the feed to a signed-in user with 200', async () => {
    const agent = await signedInAgent(testApp, { username: 'FeedReader' });
    await agent
      .post('/api/quacks')
      .send({ text: 'Hello from an integration test' })
      .expect(201);

    const response = await agent.get('/api/quacks').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        text: 'Hello from an integration test',
        user: expect.objectContaining({ username: 'feedreader' }),
      }),
    ]);
  });
});

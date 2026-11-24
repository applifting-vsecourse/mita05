// Likes over HTTP against the test database: the "API behaviour" cases
// A1–A17 in docs/features/likes/cases.md. Every case asserts the status code.
import {
  createTestApp,
  resetDatabase,
  signedInAgent,
  TestApp,
} from '@/testing/integration/test-app';
import * as request from 'supertest';

type Agent = ReturnType<typeof request.agent>;
type FeedItem = {
  id: string;
  isDeleted?: boolean;
  likeCount?: number;
  likedByMe?: boolean;
  replies?: FeedItem[];
};

describe('Likes (integration)', () => {
  let testApp: TestApp;
  let alice: Agent;
  let bob: Agent;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    alice = await signedInAgent(testApp, { username: 'Alice' });
    bob = await signedInAgent(testApp, { username: 'Bob' });
  });

  afterAll(async () => {
    await testApp.close();
  });

  const postQuack = async (agent: Agent, text = 'Lunch?'): Promise<string> =>
    (await agent.post('/api/quacks').send({ text }).expect(201)).body.id;

  const postReply = async (
    agent: Agent,
    quackId: string,
    text = 'Pizza',
  ): Promise<string> =>
    (
      await agent
        .post(`/api/quacks/${quackId}/replies`)
        .send({ text })
        .expect(201)
    ).body.id;

  const like = (agent: Agent, quackId: string): request.Test =>
    agent.put(`/api/quacks/${quackId}/like`);
  const unlike = (agent: Agent, quackId: string): request.Test =>
    agent.delete(`/api/quacks/${quackId}/like`);

  /** The quack or reply with that id, as `agent` sees it in the feed. */
  const inFeed = async (agent: Agent, id: string): Promise<FeedItem> => {
    const feed: FeedItem[] = (await agent.get('/api/quacks').expect(200)).body;
    const all = feed.flatMap((quack) => [quack, ...(quack.replies ?? [])]);
    const item = all.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`${id} is not in the feed`);
    return item;
  };

  it('A1: like answers 200 with the new count, and the feed shows it', async () => {
    const q = await postQuack(bob);

    const response = await like(alice, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await inFeed(alice, q)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  it('A2: liking twice answers 200 and still counts 1', async () => {
    const q = await postQuack(bob);
    await like(alice, q).expect(200);

    const response = await like(alice, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
  });

  it('A3: unlike answers 200 with the count back at 0', async () => {
    const q = await postQuack(bob);
    await like(alice, q).expect(200);

    const response = await unlike(alice, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('A4: unlike without having liked answers 200 and changes nothing', async () => {
    const q = await postQuack(bob);

    const response = await unlike(alice, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 0, likedByMe: false });
  });

  it('A5: signed out, like and unlike answer 401 and change nothing', async () => {
    const q = await postQuack(alice);
    await like(bob, q).expect(200);

    await testApp.http().put(`/api/quacks/${q}/like`).expect(401);
    await testApp.http().delete(`/api/quacks/${q}/like`).expect(401);

    expect(await inFeed(bob, q)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  it('A6: an unknown quack answers 404', async () => {
    await like(alice, 'nope').expect(404);
    await unlike(alice, 'nope').expect(404);
  });

  it('A7: a fully deleted quack answers 404', async () => {
    const q = await postQuack(alice);
    await like(bob, q).expect(200);
    await alice.delete(`/api/quacks/${q}`).expect(204);

    await like(bob, q).expect(404);
    await unlike(bob, q).expect(404);
  });

  it('A8: a tombstone answers 404 and shows no likes; its reply keeps its own', async () => {
    const q = await postQuack(alice);
    const r = await postReply(bob, q);
    await like(alice, q).expect(200);
    await like(bob, q).expect(200);
    await like(alice, r).expect(200);
    await alice.delete(`/api/quacks/${q}`).expect(204);

    await like(alice, q).expect(404);
    await unlike(alice, q).expect(404);

    const tombstone = await inFeed(alice, q);
    expect(tombstone.isDeleted).toBe(true);
    expect(tombstone).not.toHaveProperty('likeCount');
    expect(tombstone).not.toHaveProperty('likedByMe');
    expect(await inFeed(alice, r)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  it('A9: you can like your own quack', async () => {
    const q = await postQuack(alice);

    const response = await like(alice, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
  });

  it('A10: a reply can be liked, separately from its quack', async () => {
    const q = await postQuack(bob);
    const r = await postReply(bob, q);

    const response = await like(alice, r);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 1, likedByMe: true });
    expect(await inFeed(alice, r)).toMatchObject({ likeCount: 1 });
    expect(await inFeed(alice, q)).toMatchObject({ likeCount: 0 });
  });

  it('A11: two people make two likes', async () => {
    const q = await postQuack(alice);
    await like(alice, q).expect(200);

    const response = await like(bob, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 2, likedByMe: true });
  });

  it("A12: you can't take back someone else's like", async () => {
    const q = await postQuack(alice);
    await like(alice, q).expect(200);

    const response = await unlike(bob, q);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ likeCount: 1, likedByMe: false });
    expect(await inFeed(alice, q)).toMatchObject({ likedByMe: true });
  });

  it('A13: a user named in the body is refused with 400; the like comes from the session', async () => {
    const q = await postQuack(alice);
    await like(alice, q).expect(200);
    const aliceId = (await alice.get('/api/auth/get-session').expect(200)).body
      .user.id;

    await unlike(bob, q).send({ userId: aliceId }).expect(400);

    expect(await inFeed(alice, q)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
  });

  it('A14: the feed reports "liked by me" per viewer', async () => {
    const q = await postQuack(alice);
    await like(alice, q).expect(200);

    expect(await inFeed(alice, q)).toMatchObject({
      likeCount: 1,
      likedByMe: true,
    });
    expect(await inFeed(bob, q)).toMatchObject({
      likeCount: 1,
      likedByMe: false,
    });
  });

  it('A15: two likes from one person at the same moment count once', async () => {
    const q = await postQuack(bob);

    const responses = await Promise.all([like(alice, q), like(alice, q)]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await inFeed(alice, q)).toMatchObject({ likeCount: 1 });
  });

  it("A16: a deleted account's likes leave the count", async () => {
    const q = await postQuack(alice);
    await like(alice, q).expect(200);
    await like(bob, q).expect(200);
    const bobId = (await bob.get('/api/auth/get-session').expect(200)).body.user
      .id;

    // Account deletion has no endpoint yet; delete the user row directly.
    await testApp.prisma.user.delete({ where: { id: bobId } });

    expect(await inFeed(alice, q)).toMatchObject({ likeCount: 1 });
  });

  it('A17: a liked quack can still be deleted', async () => {
    const q = await postQuack(alice);
    await like(bob, q).expect(200);

    await alice.delete(`/api/quacks/${q}`).expect(204);

    const feed: FeedItem[] = (await alice.get('/api/quacks').expect(200)).body;
    expect(feed.map((quack) => quack.id)).not.toContain(q);
  });
});

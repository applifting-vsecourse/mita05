// Likes in the repository, with Prisma mocked: how the feed reports likes per
// viewer (R9) and that a tombstone loses its likes (R13).
// The QuackLike model doesn't exist yet (docs/adr/0002-likes.md), so rows and
// the transaction client are typed loosely here until it does.
import { PrismaService } from '@/core/prisma/prisma.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

let prisma: DeepMockProxy<PrismaService>;
let repository: QuackRepository;

beforeEach(() => {
  prisma = mockDeep<PrismaService>();
  repository = new QuackRepository(prisma);
});

type FeedRow = Awaited<ReturnType<typeof prisma.quack.findMany>>[number];

const author = {
  id: 'u1',
  name: 'Caffeinated Duck',
  username: 'CaffeinatedDuck',
  email: 'caffeinatedduck@example.com',
  emailVerified: true,
  image: null,
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  role: 'user',
  displayUsername: null,
  bio: null,
  defaultMood: null,
};

// A row as the feed query returns it, with the viewer's own like (if any)
// and the total number of likes.
const aRow = (
  id: string,
  likeCount: number,
  viewerLikes: string[],
  replies: unknown[] = [],
): FeedRow =>
  ({
    id,
    text: 'Where do we go for lunch?',
    mood: null,
    userId: 'u1',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    updatedAt: new Date('2026-01-01T12:00:00Z'),
    parentId: null,
    deletedAt: null,
    user: author,
    poll: null,
    replies,
    likes: viewerLikes.map((userId) => ({ userId })),
    _count: { likes: likeCount },
  }) as unknown as FeedRow;

describe('QuackRepository likes in the feed', () => {
  it('R9: reports the count for everyone and "liked by me" for the viewer only', async () => {
    prisma.quack.findMany.mockResolvedValue([aRow('q1', 1, [])]);

    const [quack] = await repository.getQuacks('bob');

    expect(quack).toMatchObject({ likeCount: 1, likedByMe: false });
    // only the viewer's own like is loaded, to decide likedByMe
    expect(prisma.quack.findMany.mock.calls[0][0]?.include).toMatchObject({
      likes: { where: { userId: 'bob' } },
    });
  });

  it('R9: the viewer who liked it sees it as liked', async () => {
    prisma.quack.findMany.mockResolvedValue([aRow('q1', 1, ['alice'])]);

    const [quack] = await repository.getQuacks('alice');

    expect(quack).toMatchObject({ likeCount: 1, likedByMe: true });
  });

  it('R6: replies carry their own likes', async () => {
    const reply = {
      ...aRow('r1', 2, ['alice']),
      parentId: 'q1',
      text: 'Pizza',
    };
    prisma.quack.findMany.mockResolvedValue([aRow('q1', 0, [], [reply])]);

    const [quack] = await repository.getQuacks('alice');

    expect(quack).toMatchObject({ likeCount: 0, likedByMe: false });
    expect(quack.replies?.[0]).toMatchObject({ likeCount: 2, likedByMe: true });
  });
});

describe('QuackRepository.deleteQuack and likes', () => {
  it('R13: turning a quack with replies into a tombstone erases its likes', async () => {
    prisma.$transaction.mockImplementation((callback: unknown) =>
      (callback as (tx: PrismaService) => Promise<unknown>)(prisma),
    );
    type FoundQuack = Awaited<ReturnType<typeof prisma.quack.findFirst>>;
    prisma.quack.findFirst.mockResolvedValue({
      parentId: null,
      _count: { replies: 1 },
    } as unknown as FoundQuack);

    await expect(repository.deleteQuack('q1', 'u1')).resolves.toBe(
      'tombstoned',
    );

    // mockDeep answers any property, so this works before the model exists.
    const tx = prisma as unknown as {
      quackLike: { deleteMany: jest.Mock };
    };
    expect(tx.quackLike.deleteMany).toHaveBeenCalledWith({
      where: { quackId: 'q1' },
    });
  });
});

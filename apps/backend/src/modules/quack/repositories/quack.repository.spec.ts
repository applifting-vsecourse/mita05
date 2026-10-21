// Checks the query the repository builds — Prisma itself is mocked,
// so this does not need a database.
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaQuackWithRelations, QuackRepository } from './quack.repository';

let prisma: DeepMockProxy<PrismaService>;
let repository: QuackRepository;

beforeEach(() => {
  prisma = mockDeep<PrismaService>();
  prisma.quack.findMany.mockResolvedValue([]);
  repository = new QuackRepository(prisma);
});

const findManyWhere = (): Prisma.QuackWhereInput | undefined =>
  prisma.quack.findMany.mock.calls[0][0]?.where;

const findManyInclude = (): Prisma.QuackInclude | null | undefined =>
  prisma.quack.findMany.mock.calls[0][0]?.include;

const VIEWER_ID = 'viewer';

// A row as Prisma returns it for the repository's include.
const aPrismaQuack = (
  overrides: Partial<PrismaQuackWithRelations> = {},
): PrismaQuackWithRelations => ({
  id: 'q1',
  text: 'Where do we go for lunch?',
  mood: null,
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: {
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
  },
  poll: null,
  ...overrides,
});

const aPrismaPoll = (
  myVote: string | null,
): NonNullable<PrismaQuackWithRelations['poll']> => ({
  id: 'p1',
  quackId: 'q1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  options: [
    {
      id: 'o1',
      pollId: 'p1',
      text: 'Pizza',
      position: 0,
      _count: { votes: 3 },
    },
    { id: 'o2', pollId: 'p1', text: 'Thai', position: 1, _count: { votes: 1 } },
    {
      id: 'o3',
      pollId: 'p1',
      text: 'Salad bar',
      position: 2,
      _count: { votes: 0 },
    },
  ],
  votes: myVote ? [{ optionId: myVote }] : [],
});

const matchesAnywhere = (term: string): Prisma.QuackWhereInput => {
  const contains = { contains: term, mode: 'insensitive' as const };
  return {
    OR: [
      { text: contains },
      { user: { name: contains } },
      { user: { username: contains } },
    ],
  };
};

describe('QuackRepository.getQuacks', () => {
  it('applies no filter without search terms', async () => {
    await repository.getQuacks(VIEWER_ID);

    expect(findManyWhere()).toEqual({ AND: [] });
  });

  it('requires every term to match the text, author name or username', async () => {
    await repository.getQuacks(VIEWER_ID, ['lunch', 'adela']);

    expect(findManyWhere()).toEqual({
      AND: [matchesAnywhere('lunch'), matchesAnywhere('adela')],
    });
  });

  it('escapes LIKE wildcards so they match literally', async () => {
    await repository.getQuacks(VIEWER_ID, ['50%', 'snake_case', 'back\\slash']);

    expect(findManyWhere()).toEqual({
      AND: [
        matchesAnywhere('50\\%'),
        matchesAnywhere('snake\\_case'),
        matchesAnywhere('back\\\\slash'),
      ],
    });
  });

  it("returns only the author's quacks when given an author", async () => {
    await repository.getQuacks(VIEWER_ID, ['lunch'], 'u1');

    expect(findManyWhere()).toEqual({
      userId: 'u1',
      AND: [matchesAnywhere('lunch')],
    });
  });

  it('does not filter by author without one', async () => {
    await repository.getQuacks(VIEWER_ID);

    expect(findManyWhere()?.userId).toBeUndefined();
  });
});

describe('QuackRepository.deleteQuack', () => {
  it('deletes only when the given user wrote the quack', async () => {
    prisma.quack.deleteMany.mockResolvedValue({ count: 1 });

    await expect(repository.deleteQuack('q1', 'u1')).resolves.toBe(true);
    expect(prisma.quack.deleteMany).toHaveBeenCalledWith({
      where: { id: 'q1', userId: 'u1' },
    });
  });

  it('reports false when nothing matched', async () => {
    prisma.quack.deleteMany.mockResolvedValue({ count: 0 });

    await expect(repository.deleteQuack('q1', 'someone-else')).resolves.toBe(
      false,
    );
  });
});

describe('QuackRepository.getQuackAuthorId', () => {
  it("returns the author's id", async () => {
    prisma.quack.findUnique.mockResolvedValue(aPrismaQuack({ userId: 'u1' }));

    await expect(repository.getQuackAuthorId('q1')).resolves.toBe('u1');
    expect(prisma.quack.findUnique).toHaveBeenCalledWith({
      where: { id: 'q1' },
      select: { userId: true },
    });
  });

  it('returns null for an unknown quack', async () => {
    prisma.quack.findUnique.mockResolvedValue(null);

    await expect(repository.getQuackAuthorId('nope')).resolves.toBeNull();
  });
});

describe('QuackRepository.getQuacks polls', () => {
  it('loads options in the order the author typed them, with vote counts', async () => {
    await repository.getQuacks(VIEWER_ID);

    expect(findManyInclude()).toMatchObject({
      poll: {
        include: {
          options: {
            orderBy: { position: 'asc' },
            include: { _count: { select: { votes: true } } },
          },
        },
      },
    });
  });

  it("loads only the viewer's own vote, never anyone else's", async () => {
    await repository.getQuacks(VIEWER_ID);

    expect(findManyInclude()).toMatchObject({
      poll: {
        include: {
          votes: { where: { userId: VIEWER_ID }, select: { optionId: true } },
        },
      },
    });
  });

  it('does not search poll answers', async () => {
    await repository.getQuacks(VIEWER_ID, ['pizza']);

    expect(JSON.stringify(findManyWhere())).not.toContain('poll');
  });

  it('maps counts, the total and the viewer’s pick', async () => {
    prisma.quack.findMany.mockResolvedValue([
      aPrismaQuack({ poll: aPrismaPoll('o2') }),
    ]);

    const [quack] = await repository.getQuacks(VIEWER_ID);

    expect(quack.poll).toEqual({
      id: 'p1',
      options: [
        { id: 'o1', text: 'Pizza', voteCount: 3 },
        { id: 'o2', text: 'Thai', voteCount: 1 },
        { id: 'o3', text: 'Salad bar', voteCount: 0 },
      ],
      totalVotes: 4,
      myVoteOptionId: 'o2',
    });
  });

  it('reports no pick when the viewer has not voted', async () => {
    prisma.quack.findMany.mockResolvedValue([
      aPrismaQuack({ poll: aPrismaPoll(null) }),
    ]);

    const [quack] = await repository.getQuacks(VIEWER_ID);

    expect(quack.poll?.myVoteOptionId).toBeNull();
    expect(quack.poll?.totalVotes).toBe(4);
  });

  it('maps a quack without a poll to null', async () => {
    prisma.quack.findMany.mockResolvedValue([aPrismaQuack()]);

    const [quack] = await repository.getQuacks(VIEWER_ID);

    expect(quack.poll).toBeNull();
  });
});

describe('QuackRepository.createQuack', () => {
  beforeEach(() => {
    prisma.quack.create.mockResolvedValue(aPrismaQuack());
  });

  const createData = (): Prisma.QuackCreateArgs['data'] | undefined =>
    prisma.quack.create.mock.calls[0][0]?.data;

  it('creates the poll and its answers in the same write, in the order given', async () => {
    await repository.createQuack({
      text: 'Where do we go for lunch?',
      mood: null,
      userId: 'u1',
      pollOptions: ['Pizza', 'Thai', 'Salad bar'],
    });

    expect(createData()?.poll).toEqual({
      create: {
        options: {
          create: [
            { text: 'Pizza', position: 0 },
            { text: 'Thai', position: 1 },
            { text: 'Salad bar', position: 2 },
          ],
        },
      },
    });
  });

  it('creates no poll when there are no answers', async () => {
    await repository.createQuack({
      text: 'hello',
      mood: null,
      userId: 'u1',
      pollOptions: null,
    });

    expect(createData()?.poll).toBeUndefined();
  });

  it('returns the new quack with its poll loaded for the author', async () => {
    prisma.quack.create.mockResolvedValue(
      aPrismaQuack({
        poll: {
          ...aPrismaPoll(null),
          options: aPrismaPoll(null).options.map((option) => ({
            ...option,
            _count: { votes: 0 },
          })),
        },
      }),
    );

    const quack = await repository.createQuack({
      text: 'Where do we go for lunch?',
      mood: null,
      userId: 'u1',
      pollOptions: ['Pizza', 'Thai', 'Salad bar'],
    });

    expect(prisma.quack.create.mock.calls[0][0]?.include).toMatchObject({
      poll: { include: { votes: { where: { userId: 'u1' } } } },
    });
    expect(quack.poll).toMatchObject({ totalVotes: 0, myVoteOptionId: null });
  });
});

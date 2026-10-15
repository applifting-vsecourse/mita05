// Prisma is mocked: these tests check the queries the repository sends and how
// it handles Prisma's errors. The real-database behaviour is checked separately.
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { OptionNotInPollError } from '@/modules/poll/domain/poll';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaPollForViewer } from './poll.prisma';
import { PollRepository } from './poll.repository';

let prisma: DeepMockProxy<PrismaService>;
let repository: PollRepository;

beforeEach(() => {
  prisma = mockDeep<PrismaService>();
  repository = new PollRepository(prisma);
});

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`Prisma ${code}`, {
    code,
    clientVersion: 'test',
  });

const vote = { pollId: 'p1', optionId: 'o2', userId: 'u1' };
const byPollAndUser = { pollId_userId: { pollId: 'p1', userId: 'u1' } };

describe('PollRepository.setVote', () => {
  it('upserts the one row keyed by poll and user', async () => {
    await repository.setVote(vote);

    expect(prisma.pollVote.upsert).toHaveBeenCalledWith({
      where: byPollAndUser,
      create: vote,
      update: { optionId: 'o2' },
    });
    expect(prisma.pollVote.update).not.toHaveBeenCalled();
  });

  it('retries as an update when a concurrent first vote won the insert', async () => {
    prisma.pollVote.upsert.mockRejectedValue(prismaError('P2002'));

    await repository.setVote(vote);

    expect(prisma.pollVote.update).toHaveBeenCalledWith({
      where: byPollAndUser,
      data: { optionId: 'o2' },
    });
  });

  it('turns a foreign-key refusal into OptionNotInPollError', async () => {
    prisma.pollVote.upsert.mockRejectedValue(prismaError('P2003'));

    await expect(repository.setVote(vote)).rejects.toThrow(
      OptionNotInPollError,
    );
  });

  it('turns a foreign-key refusal on the retry into OptionNotInPollError', async () => {
    prisma.pollVote.upsert.mockRejectedValue(prismaError('P2002'));
    prisma.pollVote.update.mockRejectedValue(prismaError('P2003'));

    await expect(repository.setVote(vote)).rejects.toThrow(
      OptionNotInPollError,
    );
  });

  it('passes other errors through', async () => {
    const error = new Error('connection lost');
    prisma.pollVote.upsert.mockRejectedValue(error);

    await expect(repository.setVote(vote)).rejects.toBe(error);
    expect(prisma.pollVote.update).not.toHaveBeenCalled();
  });
});

describe('PollRepository.getOptionIds', () => {
  it('returns the poll’s answer ids', async () => {
    prisma.poll.findUnique.mockResolvedValue({
      options: [{ id: 'o1' }, { id: 'o2' }],
    } as never);

    await expect(repository.getOptionIds('p1')).resolves.toEqual(['o1', 'o2']);
  });

  it('returns null for an unknown poll', async () => {
    prisma.poll.findUnique.mockResolvedValue(null);

    await expect(repository.getOptionIds('nope')).resolves.toBeNull();
  });
});

describe('PollRepository.getPoll', () => {
  const row: PrismaPollForViewer = {
    id: 'p1',
    quackId: 'q1',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    options: [
      {
        id: 'o1',
        pollId: 'p1',
        text: 'Pizza',
        position: 0,
        _count: { votes: 2 },
      },
      {
        id: 'o2',
        pollId: 'p1',
        text: 'Thai',
        position: 1,
        _count: { votes: 1 },
      },
    ],
    votes: [{ optionId: 'o2' }],
  };

  it('maps counts, the total and the viewer’s pick', async () => {
    prisma.poll.findUnique.mockResolvedValue(row);

    await expect(repository.getPoll('p1', 'u1')).resolves.toEqual({
      id: 'p1',
      options: [
        { id: 'o1', text: 'Pizza', voteCount: 2 },
        { id: 'o2', text: 'Thai', voteCount: 1 },
      ],
      totalVotes: 3,
      myVoteOptionId: 'o2',
    });
  });

  it("loads only the viewer's own vote", async () => {
    prisma.poll.findUnique.mockResolvedValue(row);

    await repository.getPoll('p1', 'u1');

    expect(prisma.poll.findUnique.mock.calls[0][0].include).toMatchObject({
      votes: { where: { userId: 'u1' } },
    });
  });

  it('returns null for an unknown poll', async () => {
    prisma.poll.findUnique.mockResolvedValue(null);

    await expect(repository.getPoll('nope', 'u1')).resolves.toBeNull();
  });
});

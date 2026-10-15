import { Prisma } from '@/generated/prisma/client';
import { Poll } from '@/modules/poll/domain/poll';

// Loads a poll the way one viewer sees it. Counts come from COUNT() over
// poll_vote, never a stored counter, and the only vote row loaded is the
// viewer's own — nobody else's vote leaves the database.
// Shared by the quack feed and the vote endpoint so both report the same numbers.
// The return type is inferred on purpose: Prisma derives the row type from it.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const pollInclude = (viewerId: string) =>
  ({
    options: {
      orderBy: { position: 'asc' },
      include: { _count: { select: { votes: true } } },
    },
    votes: { where: { userId: viewerId }, select: { optionId: true } },
  }) satisfies Prisma.PollInclude;

export type PrismaPollForViewer = Prisma.PollGetPayload<{
  include: ReturnType<typeof pollInclude>;
}>;

export const mapPrismaPollToDomain = (poll: PrismaPollForViewer): Poll => {
  const options = poll.options.map((option) => ({
    id: option.id,
    text: option.text,
    voteCount: option._count.votes,
  }));
  return {
    id: poll.id,
    options,
    totalVotes: options.reduce((sum, option) => sum + option.voteCount, 0),
    myVoteOptionId: poll.votes[0]?.optionId ?? null,
  };
};

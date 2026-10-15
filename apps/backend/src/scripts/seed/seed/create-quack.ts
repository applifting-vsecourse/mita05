import { PrismaService } from '@/core/prisma/prisma.service';

type CreateQuackParams = {
  text: string;
  userId: string;
  // Optional so the seed can spread posts over time. Without it every seeded
  // quack shares one timestamp and the feed reads like a single burst.
  createdAt?: Date;
  // Answers in display order, and who voted for which answer.
  poll?: { options: string[]; votes: { userId: string; option: string }[] };
};

export async function createQuack(
  prisma: PrismaService,
  params: CreateQuackParams,
): Promise<void> {
  const { text, userId, createdAt, poll } = params;

  const quack = await prisma.quack.create({
    data: {
      text,
      createdAt,
      user: {
        connect: {
          id: userId,
        },
      },
      poll: poll
        ? {
            create: {
              createdAt,
              options: {
                create: poll.options.map((option, position) => ({
                  text: option,
                  position,
                })),
              },
            },
          }
        : undefined,
    },
    include: { poll: { include: { options: true } } },
  });

  if (poll && quack.poll) {
    const { id: pollId, options } = quack.poll;
    await prisma.pollVote.createMany({
      data: poll.votes.map((vote) => {
        const option = options.find((o) => o.text === vote.option);
        if (!option) {
          throw new Error(`Seed vote names an unknown answer: ${vote.option}`);
        }
        return { pollId, optionId: option.id, userId: vote.userId };
      }),
    });
  }
}

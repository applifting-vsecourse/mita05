import { PrismaService } from '@/core/prisma/prisma.service';

type CreateQuackParams = {
  text: string;
  userId: string;
  // Optional so the seed can spread posts over time. Without it every seeded
  // quack shares one timestamp and the feed reads like a single burst.
  createdAt?: Date;
  // Answers in display order, and who voted for which answer.
  poll?: { options: string[]; votes: { userId: string; option: string }[] };
  // Text-only replies under the quack, oldest first.
  replies?: { text: string; userId: string; createdAt?: Date }[];
  // Deletes the quack after its replies exist, so it stays as a tombstone.
  isDeleted?: boolean;
};

export async function createQuack(
  prisma: PrismaService,
  params: CreateQuackParams,
): Promise<void> {
  const { text, userId, createdAt, poll, replies, isDeleted } = params;

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

  for (const reply of replies ?? []) {
    await prisma.quack.create({
      data: {
        text: reply.text,
        userId: reply.userId,
        parentId: quack.id,
        createdAt: reply.createdAt,
      },
    });
  }

  if (isDeleted) {
    if (!replies?.length) {
      throw new Error(
        'Seed: only a quack with replies can stay as a tombstone',
      );
    }
    // What deleting a quack with replies does: erase the content, keep the row.
    // See docs/adr/0001-deleted-quacks-become-tombstones.md.
    await prisma.poll.deleteMany({ where: { quackId: quack.id } });
    await prisma.quack.update({
      where: { id: quack.id },
      data: { text: null, mood: null, deletedAt: new Date() },
    });
  }
}

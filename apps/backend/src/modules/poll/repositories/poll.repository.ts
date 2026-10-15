import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { OptionNotInPollError, Poll } from '@/modules/poll/domain/poll';
import {
  mapPrismaPollToDomain,
  pollInclude,
} from '@/modules/poll/repositories/poll.prisma';
import { Injectable } from '@nestjs/common';

const isPrismaError = (error: unknown, code: string): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

@Injectable()
export class PollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPoll(pollId: string, viewerId: string): Promise<Poll | null> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: pollInclude(viewerId),
    });
    return poll ? mapPrismaPollToDomain(poll) : null;
  }

  /** The poll's answer ids, or null when the poll doesn't exist. */
  async getOptionIds(pollId: string): Promise<string[] | null> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      select: { options: { select: { id: true } } },
    });
    return poll ? poll.options.map((option) => option.id) : null;
  }

  /**
   * Sets the user's one vote in the poll: creates it, or moves it to another answer.
   * The (pollId, userId) primary key makes a second row impossible. Throws
   * OptionNotInPollError if the database rejects the answer for this poll.
   */
  async setVote(vote: {
    pollId: string;
    optionId: string;
    userId: string;
  }): Promise<void> {
    const where = {
      pollId_userId: { pollId: vote.pollId, userId: vote.userId },
    };
    try {
      try {
        await this.prisma.pollVote.upsert({
          where,
          create: vote,
          update: { optionId: vote.optionId },
        });
      } catch (error) {
        // Two first votes raced and the other one inserted the row first.
        // The row exists now, so this vote is a plain update.
        if (!isPrismaError(error, 'P2002')) throw error;
        await this.prisma.pollVote.update({
          where,
          data: { optionId: vote.optionId },
        });
      }
    } catch (error) {
      // The composite foreign key refused an answer that belongs to another poll.
      if (isPrismaError(error, 'P2003')) {
        throw new OptionNotInPollError(vote.optionId, vote.pollId);
      }
      throw error;
    }
  }
}

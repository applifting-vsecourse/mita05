import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  mapPrismaPollToDomain,
  pollInclude,
} from '@/modules/poll/repositories/poll.prisma';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

// Loads a quack's author and its poll, as the viewer sees it, in the same query.
// The return type is inferred on purpose: Prisma derives the row type from it.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const quackInclude = (viewerId: string) =>
  ({
    user: true,
    poll: { include: pollInclude(viewerId) },
  }) satisfies Prisma.QuackInclude;

export type PrismaQuackWithRelations = Prisma.QuackGetPayload<{
  include: ReturnType<typeof quackInclude>;
}>;

const mapPrismaQuackToDomain = (quack: PrismaQuackWithRelations): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
  poll: quack.poll ? mapPrismaPollToDomain(quack.poll) : null,
});

// Prisma's `contains` becomes ILIKE '%' || term || '%' without escaping,
// so a search for "%" or "_" would otherwise match every quack.
const escapeLikeWildcards = (term: string): string =>
  term.replace(/[\\%_]/g, '\\$&');

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * With search terms, returns only quacks where every term appears in the text, author name or username.
   * Poll answers are not searched. `viewerId` only decides whose vote is reported as `myVoteOptionId`.
   */
  async getQuacks(
    viewerId: string,
    searchTerms: string[] = [],
  ): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: {
        AND: searchTerms.map((term) => {
          const contains = {
            contains: escapeLikeWildcards(term),
            mode: 'insensitive' as const,
          };
          return {
            OR: [
              { text: contains },
              { user: { name: contains } },
              { user: { username: contains } },
            ],
          };
        }),
      },
      include: quackInclude(viewerId),
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood: QuackMood | null;
    userId: string;
    /** Answers in display order, or null for a quack without a poll. */
    pollOptions: string[] | null;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
        // Nested so the quack, poll and answers are written together or not at all.
        poll: createQuackData.pollOptions
          ? {
              create: {
                options: {
                  create: createQuackData.pollOptions.map((text, position) => ({
                    text,
                    position,
                  })),
                },
              },
            }
          : undefined,
      },
      include: quackInclude(createQuackData.userId),
    });
    return mapPrismaQuackToDomain(quack);
  }
}

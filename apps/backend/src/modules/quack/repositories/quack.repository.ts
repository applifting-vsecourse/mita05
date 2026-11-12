import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  mapPrismaPollToDomain,
  pollInclude,
} from '@/modules/poll/repositories/poll.prisma';
import {
  Quack,
  QuackAuthor,
  QuackDeletion,
  QuackMood,
  QuackReply,
} from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const replyInclude = {
  user: true,
} satisfies Prisma.QuackInclude;

// Loads a quack's author, its poll as the viewer sees it, and its replies
// (oldest first, one level deep) in the same query.
// The return type is inferred on purpose: Prisma derives the row type from it.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const quackInclude = (viewerId: string) =>
  ({
    user: true,
    poll: { include: pollInclude(viewerId) },
    replies: { include: replyInclude, orderBy: { createdAt: 'asc' } },
  }) satisfies Prisma.QuackInclude;

export type PrismaQuackWithRelations = Prisma.QuackGetPayload<{
  include: ReturnType<typeof quackInclude>;
}>;

type PrismaReply = Prisma.QuackGetPayload<{ include: typeof replyInclude }>;

const mapPrismaUserToAuthor = (user: PrismaReply['user']): QuackAuthor => ({
  id: user.id,
  name: user.name,
  username: user.username ?? '',
});

const mapPrismaReplyToDomain = (reply: PrismaReply): QuackReply => {
  // The quack_reply_shape and quack_deleted_has_no_content constraints
  // guarantee this; the check only narrows the type.
  if (reply.parentId === null || reply.text === null) {
    throw new Error(`Quack ${reply.id} is not a live reply`);
  }
  return {
    id: reply.id,
    text: reply.text,
    userId: reply.userId,
    parentId: reply.parentId,
    createdAt: reply.createdAt,
    user: mapPrismaUserToAuthor(reply.user),
  };
};

const mapPrismaQuackToDomain = (quack: PrismaQuackWithRelations): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  isDeleted: quack.deletedAt !== null,
  user: quack.user ? mapPrismaUserToAuthor(quack.user) : undefined,
  poll: quack.poll ? mapPrismaPollToDomain(quack.poll) : null,
  replies: quack.replies.map(mapPrismaReplyToDomain),
});

// P2003: a foreign key refused the write — here, the parent quack is gone.
const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2003';

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
   * Returns the quacks in the feed (not replies), newest first, each with its replies.
   * With search terms, returns only quacks where every term appears in the text, author name or username.
   * Poll answers and replies are not searched. `viewerId` only decides whose vote is reported as `myVoteOptionId`.
   * With `authorId`, returns only that user's quacks.
   * Tombstones appear only in the unfiltered feed, as placeholders for their replies:
   * search and an author filter never return them.
   */
  async getQuacks(
    viewerId: string,
    searchTerms: string[] = [],
    authorId?: string,
  ): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      where: {
        parentId: null,
        userId: authorId,
        // A tombstone's author is still stored, but must never be matched.
        deletedAt:
          searchTerms.length > 0 || authorId !== undefined ? null : undefined,
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

  /**
   * What a new reply would answer: whether that quack is itself a reply, and
   * whether it is a tombstone. Null when the quack does not exist.
   */
  async getReplyTarget(
    quackId: string,
  ): Promise<{ isReply: boolean; isDeleted: boolean } | null> {
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      select: { parentId: true, deletedAt: true },
    });
    return quack
      ? {
          isReply: quack.parentId !== null,
          isDeleted: quack.deletedAt !== null,
        }
      : null;
  }

  /**
   * Creates a reply. Returns null when the parent was deleted in the meantime
   * (its foreign key refuses the insert). The caller checks the parent first;
   * the database only catches the race.
   */
  async createReply(replyData: {
    text: string;
    userId: string;
    parentId: string;
  }): Promise<QuackReply | null> {
    try {
      const reply = await this.prisma.quack.create({
        data: {
          text: replyData.text,
          userId: replyData.userId,
          parentId: replyData.parentId,
        },
        include: replyInclude,
      });
      return mapPrismaReplyToDomain(reply);
    } catch (error) {
      if (isForeignKeyViolation(error)) return null;
      throw error;
    }
  }

  /**
   * Returns the id of the quack's author, or null when the quack does not
   * exist or is a tombstone (which, for users, doesn't exist either).
   */
  async getQuackAuthorId(quackId: string): Promise<string | null> {
    const quack = await this.prisma.quack.findFirst({
      where: { id: quackId, deletedAt: null },
      select: { userId: true },
    });
    return quack?.userId ?? null;
  }

  /**
   * Deletes the quack only if `authorId` wrote it. `null` deletes it whoever
   * wrote it, for moderators. Required, so every caller decides.
   *
   * - Without replies, the quack is removed; its poll and votes go with it.
   * - With replies, it becomes a tombstone: text, mood and poll are erased and
   *   the row stays so the replies keep their place.
   * - Deleting the last reply under a tombstone removes the tombstone too.
   *
   * Returns null when no such live quack (by that author) exists.
   * See docs/adr/0001-deleted-quacks-become-tombstones.md.
   */
  async deleteQuack(
    quackId: string,
    authorId: string | null,
  ): Promise<QuackDeletion | null> {
    // A reply that lands between counting the replies and deleting makes the
    // Restrict foreign key refuse the delete. The second attempt sees the reply
    // and leaves a tombstone instead, so the reply is never lost.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction((tx) =>
          this.deleteInTransaction(tx, quackId, authorId),
        );
      } catch (error) {
        if (attempt < 2 && isForeignKeyViolation(error)) continue;
        throw error;
      }
    }
  }

  private async deleteInTransaction(
    tx: Prisma.TransactionClient,
    quackId: string,
    authorId: string | null,
  ): Promise<QuackDeletion | null> {
    // The author is part of the filter, so the delete itself enforces ownership.
    const quack = await tx.quack.findFirst({
      where: {
        id: quackId,
        deletedAt: null,
        ...(authorId === null ? {} : { userId: authorId }),
      },
      select: { parentId: true, _count: { select: { replies: true } } },
    });
    if (!quack) return null;

    if (quack._count.replies > 0) {
      await tx.poll.deleteMany({ where: { quackId } });
      await tx.quack.update({
        where: { id: quackId },
        data: { text: null, mood: null, deletedAt: new Date() },
      });
      return 'tombstoned';
    }

    const { count } = await tx.quack.deleteMany({ where: { id: quackId } });
    if (count === 0) return null; // deleted by someone else in the meantime

    if (quack.parentId !== null) {
      // The last reply under a tombstone takes the tombstone with it.
      await tx.quack.deleteMany({
        where: {
          id: quack.parentId,
          deletedAt: { not: null },
          replies: { none: {} },
        },
      });
    }
    return 'deleted';
  }
}

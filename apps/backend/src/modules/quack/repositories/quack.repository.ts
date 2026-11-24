import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  mapPrismaPollToDomain,
  pollInclude,
} from '@/modules/poll/repositories/poll.prisma';
import {
  LikeSummary,
  Quack,
  QuackAuthor,
  QuackDeletion,
  QuackMood,
  QuackReply,
} from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

// Loads a quack's likes the way one viewer sees them: the count comes from
// COUNT() over quack_like, never a stored number, and the only like row loaded
// is the viewer's own, to decide likedByMe. See docs/adr/0002-likes.md.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const likesInclude = (viewerId: string) =>
  ({
    likes: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { likes: true } },
  }) satisfies Prisma.QuackInclude;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const replyInclude = (viewerId: string) =>
  ({
    user: true,
    ...likesInclude(viewerId),
  }) satisfies Prisma.QuackInclude;

// Loads a quack's author, its poll and likes as the viewer sees them, and its
// replies (oldest first, one level deep, each with its own likes) in the same query.
// The return type is inferred on purpose: Prisma derives the row type from it.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const quackInclude = (viewerId: string) =>
  ({
    user: true,
    poll: { include: pollInclude(viewerId) },
    replies: {
      include: replyInclude(viewerId),
      orderBy: { createdAt: 'asc' },
    },
    ...likesInclude(viewerId),
  }) satisfies Prisma.QuackInclude;

export type PrismaQuackWithRelations = Prisma.QuackGetPayload<{
  include: ReturnType<typeof quackInclude>;
}>;

type PrismaReply = Prisma.QuackGetPayload<{
  include: ReturnType<typeof replyInclude>;
}>;

type PrismaLikes = Prisma.QuackGetPayload<{
  include: ReturnType<typeof likesInclude>;
}>;

const mapPrismaLikesToDomain = (
  quack: Pick<PrismaLikes, 'likes' | '_count'>,
): LikeSummary => ({
  likeCount: quack._count.likes,
  likedByMe: quack.likes.length > 0,
});

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
    ...mapPrismaLikesToDomain(reply),
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
  ...mapPrismaLikesToDomain(quack),
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
        include: replyInclude(replyData.userId),
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
      // The update comes first: it locks the row, so a like that is being
      // added right now (it holds a share lock, see lockLiveQuack) commits
      // before the likes below are erased, and a later one sees the tombstone.
      await tx.quack.update({
        where: { id: quackId },
        data: { text: null, mood: null, deletedAt: new Date() },
      });
      await tx.poll.deleteMany({ where: { quackId } });
      await tx.quackLike.deleteMany({ where: { quackId } });
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

  /**
   * Adds the user's like, or keeps the one already there, and returns the
   * quack's likes as that user sees them. Null when there is no live quack
   * with that id (missing, deleted or a tombstone).
   */
  async like(quackId: string, userId: string): Promise<LikeSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lockLiveQuack(tx, quackId))) return null;
      // ON CONFLICT DO NOTHING: the (quackId, userId) primary key keeps it to
      // one like, also when two requests insert at the same moment.
      await tx.quackLike.createMany({
        data: [{ quackId, userId }],
        skipDuplicates: true,
      });
      return this.getLikes(tx, quackId, userId);
    });
  }

  /**
   * Removes the user's like, if there is one, and returns the quack's likes
   * as that user sees them. Null when there is no live quack with that id.
   */
  async unlike(quackId: string, userId: string): Promise<LikeSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lockLiveQuack(tx, quackId))) return null;
      await tx.quackLike.deleteMany({ where: { quackId, userId } });
      return this.getLikes(tx, quackId, userId);
    });
  }

  /**
   * Takes a share lock on the quack if it is live (exists, not a tombstone).
   * Deleting or tombstoning the quack waits for the lock, and a like waits for
   * a delete in progress and then sees its result, so a like never survives on
   * a tombstone. Likes don't block each other.
   */
  private async lockLiveQuack(
    tx: Prisma.TransactionClient,
    quackId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "quack"
      WHERE "id" = ${quackId} AND "deletedAt" IS NULL
      FOR SHARE`;
    return rows.length > 0;
  }

  private async getLikes(
    tx: Prisma.TransactionClient,
    quackId: string,
    viewerId: string,
  ): Promise<LikeSummary> {
    const quack = await tx.quack.findUniqueOrThrow({
      where: { id: quackId },
      select: likesInclude(viewerId),
    });
    return mapPrismaLikesToDomain(quack);
  }
}

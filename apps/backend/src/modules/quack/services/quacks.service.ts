import {
  CannotReplyToReplyError,
  parseSearchTerms,
  Quack,
  QuackMood,
  QuackNotFoundError,
  QuackNotOwnedError,
  QuackReply,
} from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  /** With `isOnlyMine`, lists only the quacks the viewer wrote. */
  async getQuacks(
    viewer: Identity,
    search?: string,
    isOnlyMine = false,
  ): Promise<Quack[]> {
    return this.quackRepository.getQuacks(
      viewer.id,
      parseSearchTerms(search),
      isOnlyMine ? viewer.id : undefined,
    );
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      mood?: QuackMood;
      poll?: { options: string[] };
    },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      mood: quackData.mood ?? null,
      pollOptions: quackData.poll?.options ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }

  /**
   * Replies to a quack in the feed. Replies are text only and one level deep.
   * Throws QuackNotFoundError when the quack doesn't exist or is a tombstone,
   * and CannotReplyToReplyError when it is itself a reply.
   */
  async createReply(
    user: Identity,
    parentId: string,
    text: string,
  ): Promise<QuackReply> {
    const target = await this.quackRepository.getReplyTarget(parentId);
    // For users a tombstone doesn't exist: there's nothing left to reply to.
    if (target === null || target.isDeleted) {
      throw new QuackNotFoundError(parentId);
    }
    if (target.isReply) {
      throw new CannotReplyToReplyError(parentId);
    }

    const reply = await this.quackRepository.createReply({
      text,
      parentId,
      // the author is taken from the session, never from the request
      userId: user.id,
    });
    // Null: the quack was deleted between the check and the insert.
    if (reply === null) {
      throw new QuackNotFoundError(parentId);
    }
    return reply;
  }

  /**
   * Deletes a quack or a reply. Authors may delete their own; admins
   * (moderators) may delete anyone's. A quack with replies becomes a tombstone
   * (content erased, replies kept) — see QuackRepository.deleteQuack.
   * Throws QuackNotFoundError or QuackNotOwnedError.
   */
  async deleteQuack(user: Identity, quackId: string): Promise<void> {
    const authorId = await this.quackRepository.getQuackAuthorId(quackId);
    if (authorId === null) {
      throw new QuackNotFoundError(quackId);
    }
    // The role comes from the session user, never from the request.
    const isAdmin = user.role === 'admin';
    if (authorId !== user.id && !isAdmin) {
      throw new QuackNotOwnedError(quackId);
    }

    // For non-admins the repository re-checks the author, so this can't delete
    // someone else's quack. Null here means it was deleted in the meantime.
    const deletion = await this.quackRepository.deleteQuack(
      quackId,
      isAdmin ? null : user.id,
    );
    if (deletion === null) {
      throw new QuackNotFoundError(quackId);
    }
  }
}

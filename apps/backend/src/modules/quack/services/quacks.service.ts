import {
  parseSearchTerms,
  Quack,
  QuackMood,
  QuackNotFoundError,
  QuackNotOwnedError,
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
   * Deletes a quack with its poll and votes. Authors may delete their own
   * quacks; admins (moderators) may delete anyone's.
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
    // someone else's quack. False here means it was deleted in the meantime.
    const isDeleted = await this.quackRepository.deleteQuack(
      quackId,
      isAdmin ? null : user.id,
    );
    if (!isDeleted) {
      throw new QuackNotFoundError(quackId);
    }
  }
}

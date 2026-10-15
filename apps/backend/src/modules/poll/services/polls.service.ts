import {
  OptionNotInPollError,
  Poll,
  PollNotFoundError,
} from '@/modules/poll/domain/poll';
import { PollRepository } from '@/modules/poll/repositories/poll.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PollsService {
  constructor(private readonly pollRepository: PollRepository) {}

  /**
   * Sets the user's vote and returns the poll with fresh counts.
   * Anyone signed in may vote, the poll's author included.
   * Throws PollNotFoundError or OptionNotInPollError.
   */
  async vote(user: Identity, pollId: string, optionId: string): Promise<Poll> {
    const optionIds = await this.pollRepository.getOptionIds(pollId);
    if (!optionIds) {
      throw new PollNotFoundError(pollId);
    }
    if (!optionIds.includes(optionId)) {
      throw new OptionNotInPollError(optionId, pollId);
    }

    await this.pollRepository.setVote({
      pollId,
      optionId,
      // the voter comes from the session, never from the request body
      userId: user.id,
    });

    const poll = await this.pollRepository.getPoll(pollId, user.id);
    if (!poll) {
      throw new PollNotFoundError(pollId);
    }
    return poll;
  }
}

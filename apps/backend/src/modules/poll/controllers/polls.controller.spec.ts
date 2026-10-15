import {
  OptionNotInPollError,
  PollNotFoundError,
} from '@/modules/poll/domain/poll';
import { PollsService } from '@/modules/poll/services/polls.service';
import { Identity } from '@/shared/auth/domain/identity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { PollsController } from './polls.controller';

// The real guard imports BetterAuth and its email templates, which Jest can't
// load. Sign-in is not what this spec tests; the controller's error mapping is.
jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const voter = { id: 'voter' } as Identity;

describe('PollsController.vote', () => {
  it('returns the poll with fresh counts', async () => {
    const service = mock<PollsService>();
    const poll = {
      id: 'p1',
      options: [{ id: 'o1', text: 'Pizza', voteCount: 1 }],
      totalVotes: 1,
      myVoteOptionId: 'o1',
    };
    service.vote.mockResolvedValue(poll);

    await expect(
      new PollsController(service).vote(voter, 'p1', { optionId: 'o1' }),
    ).resolves.toEqual(poll);
    expect(service.vote).toHaveBeenCalledWith(voter, 'p1', 'o1');
  });

  it('answers 404 for an unknown poll', async () => {
    const service = mock<PollsService>();
    service.vote.mockRejectedValue(new PollNotFoundError('nope'));

    await expect(
      new PollsController(service).vote(voter, 'nope', { optionId: 'o1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('answers 400 for an answer from another poll', async () => {
    const service = mock<PollsService>();
    service.vote.mockRejectedValue(new OptionNotInPollError('o9', 'p1'));

    await expect(
      new PollsController(service).vote(voter, 'p1', { optionId: 'o9' }),
    ).rejects.toThrow(BadRequestException);
  });
});
